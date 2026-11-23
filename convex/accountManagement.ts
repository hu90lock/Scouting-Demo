import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { components } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

async function requireManager(ctx: QueryCtx | MutationCtx, eventCode: string) {
  const managerId = await getAuthUserId(ctx)
  if (!managerId) throw new Error("Sign in to manage scout accounts.")
  const unlocked = await ctx.db.query("accountManagementAccess")
    .withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", managerId))
    .first()
  if (!unlocked) throw new Error("Unlock account management before changing accounts.")
  return managerId
}

export const access = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { unlocked: false }
    const access = await ctx.db.query("accountManagementAccess")
      .withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", userId))
      .first()
    return { unlocked: access !== null }
  },
})

export const unlock = mutation({
  args: { eventCode: v.string(), password: v.string() },
  handler: async (ctx, { eventCode, password }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Sign in to manage your account.")
    const configuredPassword = process.env.PRIMARY_PICK_LIST_PASSWORD
    if (!configuredPassword) throw new Error("Account management access is not configured on this Convex deployment.")
    if (password !== configuredPassword) throw new Error("Incorrect account management password.")
    const existing = await ctx.db.query("accountManagementAccess")
      .withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", userId))
      .first()
    if (existing) await ctx.db.patch(existing._id, { unlockedAt: Date.now() })
    else await ctx.db.insert("accountManagementAccess", { eventCode, ownerId: userId, unlockedAt: Date.now() })
    return true
  },
})

export const listAccounts = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    await requireManager(ctx, eventCode)
    const profiles = await ctx.db.query("scoutProfiles").collect()
    const users = await ctx.db.query("users").collect()
    const accounts = new Map<string, { scoutId: string; scoutName: string; username: string }>()
    for (const user of users) {
      const username = await ctx.runQuery(components.authUsername.public.getUsername, { userId: user._id })
      if (!username) continue
      const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId: user._id })
      const ownerIds = new Set([user._id, ...sessions.map(session => session.sessionId)])
      const profile = profiles.find(row => row.ownerId === user._id) ?? profiles.find(row => ownerIds.has(row.ownerId))
      accounts.set(user._id, { scoutId: user._id, scoutName: profile?.displayName ?? "", username })
    }
    return [...accounts.values()].sort((a, b) => a.scoutName.localeCompare(b.scoutName))
  },
})

export const updateScoutAccount = mutation({
  args: { eventCode: v.string(), scoutId: v.string(), displayName: v.string() },
  handler: async (ctx, { eventCode, scoutId, displayName }) => {
    const managerId = await requireManager(ctx, eventCode)
    const normalizedName = displayName.trim()
    if (normalizedName.length < 2 || normalizedName.length > 40) throw new Error("Scout nickname must be between 2 and 40 characters.")
    const targetUser = await ctx.db.get(scoutId as Id<"users">)
    if (!targetUser) throw new Error("That scout account no longer exists.")
    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId: scoutId })
    const ownerIds = [scoutId, ...sessions.map(session => session.sessionId)]
    const profiles = await ctx.db.query("scoutProfiles").collect()
    const accountProfiles = profiles.filter(profile => ownerIds.includes(profile.ownerId))
    const currentProfile = accountProfiles.find(profile => profile.ownerId === scoutId) ?? accountProfiles[0]
    if (currentProfile) await ctx.db.patch(currentProfile._id, { ownerId: scoutId, displayName: normalizedName, updatedAt: Date.now() })
    else await ctx.db.insert("scoutProfiles", { ownerId: scoutId, displayName: normalizedName, updatedAt: Date.now() })
    for (const duplicate of accountProfiles) if (duplicate._id !== currentProfile?._id) await ctx.db.delete(duplicate._id)
    const ownerIdSet = new Set(ownerIds)
    const assignments = await ctx.db.query("scoutAssignments").collect()
    for (const assignment of assignments) {
      if (assignment.scoutId && ownerIdSet.has(assignment.scoutId)) await ctx.db.patch(assignment._id, { scoutId, scoutName: normalizedName, updatedAt: Date.now() })
    }
    return { updated: true, managerId }
  },
})

export const deleteScoutAccount = mutation({
  args: { eventCode: v.string(), scoutId: v.string() },
  handler: async (ctx, { eventCode, scoutId }) => {
    const managerId = await requireManager(ctx, eventCode)
    if (managerId === scoutId) throw new Error("You cannot delete the account you are currently using to manage accounts.")
    const targetUser = await ctx.db.get(scoutId as Id<"users">)
    if (!targetUser) throw new Error("That scout account no longer exists.")
    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId: scoutId })
    const sessionIds = sessions.map(session => session.sessionId)
    await ctx.runMutation(components.auth.public.revokeSessions, { sessionIds })
    await ctx.runMutation(components.authUsername.public.deleteUsername, { userId: scoutId })
    const ownerIds = new Set([scoutId, ...sessionIds])
    const profiles = await ctx.db.query("scoutProfiles").collect()
    for (const profile of profiles) if (ownerIds.has(profile.ownerId)) await ctx.db.delete(profile._id)
    const assignments = await ctx.db.query("scoutAssignments").collect()
    for (const assignment of assignments) if (assignment.scoutId && ownerIds.has(assignment.scoutId)) await ctx.db.delete(assignment._id)
    for (const assignment of assignments) if (ownerIds.has(assignment.assignedBy)) await ctx.db.patch(assignment._id, { assignedBy: "deleted-account" })
    const pickLists = await ctx.db.query("pickLists").collect()
    for (const pickList of pickLists) if (ownerIds.has(pickList.ownerId)) await ctx.db.delete(pickList._id)
    const predictions = await ctx.db.query("eventPredictions").collect()
    for (const prediction of predictions) if (ownerIds.has(prediction.ownerId)) await ctx.db.delete(prediction._id)
    const accountAccess = await ctx.db.query("accountManagementAccess").collect()
    for (const access of accountAccess) if (ownerIds.has(access.ownerId)) await ctx.db.delete(access._id)
    const primaryAccess = await ctx.db.query("primaryPickListAccess").collect()
    for (const access of primaryAccess) if (ownerIds.has(access.ownerId)) await ctx.db.delete(access._id)
    const matchReports = await ctx.db.query("matchReports").collect()
    for (const report of matchReports) if (ownerIds.has(report.scoutId)) await ctx.db.patch(report._id, { scoutId: "deleted-scout" })
    const pitReports = await ctx.db.query("pitScouting").collect()
    for (const report of pitReports) if (ownerIds.has(report.scoutId)) await ctx.db.patch(report._id, { scoutId: "deleted-scout" })
    await ctx.db.delete(scoutId as Id<"users">)
    return { deleted: true }
  },
})
