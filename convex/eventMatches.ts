import { query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => await ctx.db.query("eventMatches").withIndex("by_event_match", q => q.eq("eventCode", eventCode)).collect(),
})

export const get = query({
  args: { eventCode: v.string(), toaMatchKey: v.string() },
  handler: async (ctx, { eventCode, toaMatchKey }) => await ctx.db.query("eventMatches").withIndex("by_event_key", q => q.eq("eventCode", eventCode).eq("toaMatchKey", toaMatchKey)).first(),
})
