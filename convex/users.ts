import { internalMutation } from "./_generated/server"
import { v } from "convex/values"

export const createUserPassword = internalMutation({
  args: { method: v.object({ name: v.literal("usernamePassword"), profile: v.object({}) }) },
  handler: async (ctx) => await ctx.db.insert("users", { username: `scout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }),
})



