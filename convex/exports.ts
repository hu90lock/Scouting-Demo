import { query } from "./_generated/server"
import { v } from "convex/values"

export const eventWorkbook = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Sign in to export event data.")
    const [event, teams, matches, pitReports, matchReports, pickLists, predictions] = await Promise.all([
      ctx.db.query("events").withIndex("by_code", q => q.eq("code", eventCode)).first(),
      ctx.db.query("teams").withIndex("by_event", q => q.eq("eventCode", eventCode)).collect(),
      ctx.db.query("eventMatches").withIndex("by_event", q => q.eq("eventCode", eventCode)).collect(),
      ctx.db.query("pitScouting").withIndex("by_event_team", q => q.eq("eventCode", eventCode)).collect(),
      ctx.db.query("matchReports").withIndex("by_event", q => q.eq("eventCode", eventCode)).collect(),
      ctx.db.query("pickLists").withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", identity.subject)).collect(),
      ctx.db.query("eventPredictions").withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", identity.subject)).collect(),
    ])
    return { event, teams, matches, pitReports, matchReports, pickLists, predictions }
  },
})
