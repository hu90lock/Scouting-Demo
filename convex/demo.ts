import { mutation } from "./_generated/server"
import { v } from "convex/values"

const demoTeams = [
  { number: 32943, name: "Blue Ignition Purple", city: "Saltillo", state: "COA" },
  { number: 37319, name: "TECHNO GIRLS", city: "Saltillo", state: "COA" },
  { number: 38252, name: "Command C", city: "Torreón", state: "COA" },
  { number: 23749, name: "DEROF", city: "Torreón", state: "COA" },
  { number: 21678, name: "Thunder Eagles", city: "Torreón", state: "COA" },
  { number: 26597, name: "ROULT", city: "Torreón", state: "COA" },
  { number: 17755, name: "CERBOTICS - BLUE", city: "Torreón", state: "COA" },
  { number: 37521, name: "LOBOTICS", city: "Torreón", state: "COA" },
  { number: 15600, name: "CERBOTICS - RED", city: "Torreón", state: "COA" },
  { number: 25859, name: "Blue Ignition Sky", city: "Saltillo", state: "COA" },
  { number: 31853, name: "Code C - White", city: "Torreón", state: "COA" },
  { number: 25951, name: "DESERT EAGLES - JOHN DEERE", city: "Torreón", state: "COA" },
  { number: 24104, name: "Code C - Black", city: "Torreón", state: "COA" },
  { number: 25903, name: "NOA", city: "Torreón", state: "COA" },
  { number: 38295, name: "TecMinators", city: "Torreón", state: "COA" },
]

export const ensureMxcoqDemo = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("teams").withIndex("by_event", q => q.eq("eventCode", "MXCOQ")).collect()
    const currentEvent = await ctx.db.query("events").withIndex("by_code", q => q.eq("code", "MXCOQ")).first()
    if (currentEvent?.source === "orange-alliance") return existing.filter(team => team.competing !== false).length
    if (existing.some(team => !team.tags.includes("Demo roster"))) return existing.filter(team => team.competing !== false).length

    const allEvents = await ctx.db.query("events").collect()
    for (const prior of allEvents) if (prior.active) await ctx.db.patch(prior._id, { active: false })
    if (currentEvent) await ctx.db.patch(currentEvent._id, { active: true, teamCount: demoTeams.length, competingTeamCount: demoTeams.length, source: "demo" })
    else await ctx.db.insert("events", { code: "MXCOQ", toaKey: "2627-MEX-COQ", name: "Regional Coahuila — Torreón", seasonKey: "2627", city: "Torreón", stateProv: "COA", country: "Mexico", teamCount: demoTeams.length, competingTeamCount: demoTeams.length, matchCount: 0, active: true, source: "demo" })
    if (existing.length) {
      for (const team of existing) await ctx.db.patch(team._id, { competing: true, inEvent: true })
      return existing.length
    }

    for (const team of demoTeams) {
      await ctx.db.insert("teams", {
        eventCode: "MXCOQ",
        ...team,
        competing: true,
        inEvent: true,
        status: "Not scouted",
        tier: "Uncategorized",
        driver: 0,
        auto: 0,
        teleop: 0,
        tags: ["Demo roster", "Coahuila"],
      })
    }
    return demoTeams.length
  },
})
