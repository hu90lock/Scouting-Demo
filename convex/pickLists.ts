import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const tiers = v.record(v.string(), v.array(v.number()))
async function ownerId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) { const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error("Authentication required"); return identity.subject }
export const get = query({ args: { eventCode: v.string(), listName: v.string() }, handler: async (ctx, args) => { const owner = await ownerId(ctx); return await ctx.db.query("pickLists").withIndex("by_event_owner", q => q.eq("eventCode", args.eventCode).eq("ownerId", owner)).filter(q => q.eq(q.field("listName"), args.listName)).first() } })
export const mine = query({ args: { eventCode: v.string() }, handler: async (ctx, { eventCode }) => { const identity = await ctx.auth.getUserIdentity(); if (!identity) return []; return await ctx.db.query("pickLists").withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", identity.subject)).collect() } })
export const save = mutation({ args: { eventCode: v.string(), listName: v.string(), tiers }, handler: async (ctx, input) => { const owner = await ownerId(ctx); const existing = await ctx.db.query("pickLists").withIndex("by_event_owner", q => q.eq("eventCode", input.eventCode).eq("ownerId", owner)).filter(q => q.eq(q.field("listName"), input.listName)).first(); const value = { ...input, ownerId: owner, updatedAt: Date.now() }; if (existing) { await ctx.db.patch(existing._id, value); return existing._id } return await ctx.db.insert("pickLists", value) } })

export const unlockPrimary = mutation({ args: { eventCode: v.string(), password: v.string() }, handler: async (ctx, { eventCode, password }) => {
  const owner = await ownerId(ctx)
  const configuredPassword = process.env.PRIMARY_PICK_LIST_PASSWORD
  if (!configuredPassword) throw new Error("Primary list access is not configured on this Convex deployment.")
  if (password !== configuredPassword) throw new Error("Incorrect primary list password.")
  const existing = await ctx.db.query("primaryPickListAccess").withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", owner)).first()
  if (existing) await ctx.db.patch(existing._id, { unlockedAt: Date.now() })
  else await ctx.db.insert("primaryPickListAccess", { eventCode, ownerId: owner, unlockedAt: Date.now() })
  return true
} })

export const primary = query({ args: { eventCode: v.string() }, handler: async (ctx, { eventCode }) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return { unlocked: false, tiers: null as Record<string, number[]> | null, updatedAt: null as number | null }
  const access = await ctx.db.query("primaryPickListAccess").withIndex("by_event_owner", q => q.eq("eventCode", eventCode).eq("ownerId", identity.subject)).first()
  if (!access) return { unlocked: false, tiers: null as Record<string, number[]> | null, updatedAt: null as number | null }
  const list = await ctx.db.query("primaryPickLists").withIndex("by_event", q => q.eq("eventCode", eventCode)).first()
  return { unlocked: true, tiers: list?.tiers ?? null, updatedAt: list?.updatedAt ?? null }
} })

export const savePrimary = mutation({ args: { eventCode: v.string(), tiers }, handler: async (ctx, input) => {
  const owner = await ownerId(ctx)
  const access = await ctx.db.query("primaryPickListAccess").withIndex("by_event_owner", q => q.eq("eventCode", input.eventCode).eq("ownerId", owner)).first()
  if (!access) throw new Error("Unlock the Primary list before saving changes.")
  const existing = await ctx.db.query("primaryPickLists").withIndex("by_event", q => q.eq("eventCode", input.eventCode)).first()
  const value = { eventCode: input.eventCode, tiers: input.tiers, updatedBy: owner, updatedAt: Date.now() }
  if (existing) { await ctx.db.patch(existing._id, value); return existing._id }
  return await ctx.db.insert("primaryPickLists", value)
} })
