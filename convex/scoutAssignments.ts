import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { robotStationsForSchedule, type MatchRobotStation, teamAtRobotStation } from "./scoutingOptions"
import { components } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

export const list = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    if (!await ctx.auth.getUserIdentity()) throw new Error("Sign in to view scout assignments.")
    const [assignments, profiles] = await Promise.all([
      ctx.db.query("scoutAssignments").withIndex("by_event", q => q.eq("eventCode", eventCode)).collect(),
      ctx.db.query("scoutProfiles").collect(),
    ])
    const resolvedIds = new Map<string, string | null>()
    const profilesByUser = new Map<string, (typeof profiles)[number] | undefined>()
    const resolveUserId = async (ownerId: string) => {
      if (resolvedIds.has(ownerId)) return resolvedIds.get(ownerId) ?? undefined
      const user = await ctx.db.get(ownerId as Id<"users">)
      const session = user ? null : await ctx.runQuery(components.auth.public.getSession, { sessionId: ownerId })
      const userId = user ? ownerId : session?.userId ?? null
      resolvedIds.set(ownerId, userId)
      return userId ?? undefined
    }
    const profileForUser = async (userId: string) => {
      if (profilesByUser.has(userId)) return profilesByUser.get(userId)
      let profile = profiles.find(row => row.ownerId === userId)
      if (!profile) {
        const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId })
        const sessionIds = new Set(sessions.map(session => session.sessionId))
        profile = profiles.find(row => sessionIds.has(row.ownerId))
      }
      profilesByUser.set(userId, profile)
      return profile
    }
    return await Promise.all(assignments.map(async assignment => {
      const legacyProfile = profiles.find(profile => profile.ownerId === assignment.scoutId)
        ?? profiles.find(profile => profile.ownerId === assignment.scoutName)
        ?? profiles.find(profile => profile.displayName.trim().toLocaleLowerCase() === assignment.scoutName.trim().toLocaleLowerCase())
      const ownerReference = assignment.scoutId ?? legacyProfile?.ownerId
      if (!ownerReference) return assignment
      const scoutId = await resolveUserId(ownerReference)
        ?? (legacyProfile && legacyProfile.ownerId !== ownerReference ? await resolveUserId(legacyProfile.ownerId) : undefined)
      if (!scoutId) return assignment
      const profile = await profileForUser(scoutId) ?? legacyProfile
      return { ...assignment, scoutId, scoutName: profile?.displayName ?? assignment.scoutName }
    }))
  },
})

export const registeredScouts = query({
  args: {},
  handler: async ctx => {
    if (!await ctx.auth.getUserIdentity()) throw new Error("Sign in to browse registered scouts.")
    const profiles = await ctx.db.query("scoutProfiles").collect()
    const scouts = new Map<string, { scoutId: string; scoutName: string }>()
    for (const profile of profiles) {
      if (!profile.displayName.trim()) continue
      const user = await ctx.db.get(profile.ownerId as Id<"users">)
      const session = user ? null : await ctx.runQuery(components.auth.public.getSession, { sessionId: profile.ownerId })
      const scoutId = user ? profile.ownerId : session?.userId
      if (scoutId && !scouts.has(scoutId)) scouts.set(scoutId, { scoutId, scoutName: profile.displayName })
    }
    return [...scouts.values()].sort((a, b) => a.scoutName.localeCompare(b.scoutName))
  },
})

export const saveMatch = mutation({
  args: {
    eventCode: v.string(),
    matchKey: v.string(),
    assignments: v.array(v.object({ station: v.union(v.literal("red1"), v.literal("red2"), v.literal("red3"), v.literal("blue1"), v.literal("blue2"), v.literal("blue3")), scoutId: v.optional(v.string()) })),
  },
  handler: async (ctx, input) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Sign in to assign a scout.")
    const match = await ctx.db.query("eventMatches").withIndex("by_event_key", q => q.eq("eventCode", input.eventCode).eq("toaMatchKey", input.matchKey)).first()
    if (!match) throw new Error("This match is no longer in the imported event schedule.")
    const eventMatches = await ctx.db.query("eventMatches").withIndex("by_event", q => q.eq("eventCode", input.eventCode)).collect()
    const expectedStations = robotStationsForSchedule(eventMatches).map(item => item.key)
    if (input.assignments.length !== expectedStations.length || new Set(input.assignments.map(item => item.station)).size !== expectedStations.length || input.assignments.some(item => !expectedStations.includes(item.station))) {
      throw new Error("Assignments must include every scheduled robot station exactly once.")
    }

    const normalized = await Promise.all(input.assignments.map(async item => {
      if (!item.scoutId) return { station: item.station, scoutId: undefined, scoutName: "" }
      const profile = await ctx.db.query("scoutProfiles").withIndex("by_owner", q => q.eq("ownerId", item.scoutId!)).first()
      if (!profile?.displayName.trim()) throw new Error("Choose a registered scout account.")
      return { station: item.station, scoutId: item.scoutId, scoutName: profile.displayName.trim() }
    }))
    const assignedScouts = normalized.filter(item => item.scoutId).map(item => item.scoutId)
    if (new Set(assignedScouts).size !== assignedScouts.length) throw new Error("Assign each scout account to only one robot in a match.")

    const existing = await ctx.db.query("scoutAssignments").withIndex("by_event_match", q => q.eq("eventCode", input.eventCode).eq("matchKey", input.matchKey)).collect()
    let savedCount = 0
    for (const assignment of normalized) {
      const station = assignment.station as MatchRobotStation
      const teamNumber = teamAtRobotStation(station, match.redTeamNumbers, match.blueTeamNumbers)
      const prior = existing.find(row => row.station === station || (row.station === undefined && teamNumber !== undefined && row.teamNumber === teamNumber))
      if (!assignment.scoutName) {
        if (prior) await ctx.db.delete(prior._id)
        continue
      }
      const value = { eventCode: input.eventCode, matchKey: input.matchKey, matchName: match.matchName, ...(teamNumber === undefined ? {} : { teamNumber }), station, ...(assignment.scoutId ? { scoutId: assignment.scoutId } : {}), scoutName: assignment.scoutName, assignedBy: identity.subject, updatedAt: Date.now() }
      if (prior) await ctx.db.patch(prior._id, value)
      else await ctx.db.insert("scoutAssignments", value)
      savedCount++
    }
    return savedCount
  },
})
