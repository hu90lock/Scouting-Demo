import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { DRIVE_TRAIN_OPTIONS, INTAKE_TYPE_OPTIONS, MOTOR_TYPE_OPTIONS, PIT_CAPABILITY_OPTIONS } from "./scoutingOptions"

const args = { eventCode: v.string(), teamNumber: v.number(), driveTrain: v.string(), frameWidth: v.optional(v.number()), frameLength: v.optional(v.number()), motorType: v.optional(v.string()), totalMotors: v.optional(v.number()), totalServos: v.optional(v.number()), intakeType: v.optional(v.string()), capabilities: v.array(v.string()) }
export const get = query({ args: { eventCode: v.string(), teamNumber: v.number() }, handler: async (ctx, input) => await ctx.db.query("pitScouting").withIndex("by_event_team", q => q.eq("eventCode", input.eventCode).eq("teamNumber", input.teamNumber)).first() })
export const save = mutation({ args, handler: async (ctx, input) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Sign in to save a pit report.")
  if (!DRIVE_TRAIN_OPTIONS.some(option => option === input.driveTrain)) throw new Error("Choose a valid drive train type.")
  if (input.motorType && !MOTOR_TYPE_OPTIONS.some(option => option === input.motorType)) throw new Error("Choose a valid motor type.")
  if (input.intakeType && !INTAKE_TYPE_OPTIONS.some(option => option === input.intakeType)) throw new Error("Choose a valid intake type.")
  if (input.capabilities.some(capability => !PIT_CAPABILITY_OPTIONS.some(option => option === capability))) throw new Error("One or more robot capabilities are invalid.")
  const dimensions = [input.frameWidth, input.frameLength]
  if (dimensions.some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) throw new Error("Frame dimensions must be zero or greater.")
  const counts = [input.totalMotors, input.totalServos]
  if (counts.some(value => value !== undefined && (!Number.isInteger(value) || value < 0))) throw new Error("Motor and servo counts must be non-negative whole numbers.")
  const team = await ctx.db.query("teams").withIndex("by_event_number", q => q.eq("eventCode", input.eventCode).eq("number", input.teamNumber)).first()
  if (!team) throw new Error("The selected team is not in this event's roster.")
  const existing = await ctx.db.query("pitScouting").withIndex("by_event_team", q => q.eq("eventCode", input.eventCode).eq("teamNumber", input.teamNumber)).first()
  const value = { ...input, scoutId: identity.subject, submittedAt: Date.now() }
  const id = existing ? existing._id : await ctx.db.insert("pitScouting", value)
  if (existing) await ctx.db.patch(existing._id, value)
  await ctx.db.patch(team._id, { status: "Scouted" })
  return id
} })
