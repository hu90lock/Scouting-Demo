import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { components } from "./_generated/api"

export const mine = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db.query("eventPredictions").withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", identity.subject)).collect()
  },
})

export const leaderboard = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    const [predictions, matches] = await Promise.all([
      ctx.db.query("eventPredictions").withIndex("by_event", q => q.eq("eventCode", eventCode)).collect(),
      ctx.db.query("eventMatches").withIndex("by_event", q => q.eq("eventCode", eventCode)).collect(),
    ])
    const matchesByKey = new Map(matches.map(match => [match.toaMatchKey, match]))
    const totals = new Map<string, { correct: number; incorrect: number; resolved: number; predictions: number }>()

    for (const prediction of predictions) {
      const current = totals.get(prediction.ownerId) ?? { correct: 0, incorrect: 0, resolved: 0, predictions: 0 }
      current.predictions++
      const match = matchesByKey.get(prediction.matchKey)
      if (match?.redScore !== undefined && match.blueScore !== undefined) {
        const result = match.redScore === match.blueScore ? "tie" : match.redScore > match.blueScore ? "red" : "blue"
        current.resolved++
        if (prediction.pick === result) current.correct++
        else current.incorrect++
      }
      totals.set(prediction.ownerId, current)
    }

    const ranked = await Promise.all([...totals].map(async ([ownerId, scores]) => {
      const profile = await ctx.db.query("scoutProfiles").withIndex("by_owner", q => q.eq("ownerId", ownerId)).first()
      return { ownerId, scoutName: profile?.displayName, ...scores }
    }))
    ranked.sort((a, b) => b.correct - a.correct || a.incorrect - b.incorrect || b.resolved - a.resolved || a.ownerId.localeCompare(b.ownerId))
    return ranked.map((scout, index) => ({
      rank: index + 1,
      scoutName: scout.scoutName || `Scout ${index + 1}`,
      correct: scout.correct,
      incorrect: scout.incorrect,
      resolved: scout.resolved,
      predictions: scout.predictions,
    }))
  },
})

export const myProfile = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    const userId = await getAuthUserId(ctx)
    if (!identity || !userId) return { displayName: "" }
    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId })
    const owners = new Set([userId, ...sessions.map(session => session.sessionId)])
    const profiles = await ctx.db.query("scoutProfiles").collect()
    const profile = profiles.find(row => row.ownerId === userId) ?? profiles.find(row => owners.has(row.ownerId))
    return { displayName: profile?.displayName ?? "", ownerId: userId }
  },
})

export const setMyProfile = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const identity = await ctx.auth.getUserIdentity()
    const userId = await getAuthUserId(ctx)
    if (!identity || !userId) throw new Error("Sign in to set your leaderboard name.")
    const normalizedName = displayName.trim()
    if (normalizedName.length < 2 || normalizedName.length > 40) throw new Error("Your scout name must be between 2 and 40 characters.")
    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId })
    const owners = new Set([userId, ...sessions.map(session => session.sessionId)])
    const profiles = await ctx.db.query("scoutProfiles").collect()
    const accountProfiles = profiles.filter(profile => owners.has(profile.ownerId))
    const existing = accountProfiles.find(profile => profile.ownerId === userId) ?? accountProfiles[0]
    const value = { ownerId: userId, displayName: normalizedName, updatedAt: Date.now() }
    if (existing) {
      await ctx.db.patch(existing._id, value)
    } else {
      await ctx.db.insert("scoutProfiles", value)
    }
    const assignments = await ctx.db.query("scoutAssignments").collect()
    for (const assignment of assignments) {
      if (assignment.scoutId && owners.has(assignment.scoutId)) await ctx.db.patch(assignment._id, { scoutId: userId, scoutName: normalizedName, updatedAt: Date.now() })
    }
    for (const duplicate of accountProfiles) if (duplicate._id !== existing?._id) await ctx.db.delete(duplicate._id)
    return userId
  },
})

export const save = mutation({
  args: { eventCode: v.string(), matchKey: v.string(), pick: v.union(v.literal("red"), v.literal("blue"), v.literal("tie")) },
  handler: async (ctx, input) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Sign in to save event predictions.")
    const existing = await ctx.db.query("eventPredictions").withIndex("by_event_owner_match", q => q.eq("eventCode", input.eventCode).eq("ownerId", identity.subject).eq("matchKey", input.matchKey)).first()
    const value = { ...input, ownerId: identity.subject, updatedAt: Date.now() }
    if (existing) {
      await ctx.db.patch(existing._id, value)
      return existing._id
    }
    return await ctx.db.insert("eventPredictions", value)
  },
})
