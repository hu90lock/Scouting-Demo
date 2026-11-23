import { internalMutation, query } from "./_generated/server"
import { v } from "convex/values"
import { robotStationsForSchedule, teamAtRobotStation } from "./scoutingOptions"

const eventFields = {
  code: v.string(),
  toaKey: v.string(),
  name: v.string(),
  seasonKey: v.string(),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  city: v.optional(v.string()),
  stateProv: v.optional(v.string()),
  country: v.optional(v.string()),
  teamCount: v.number(),
  competingTeamCount: v.number(),
  matchCount: v.number(),
}
const teamFields = v.array(v.object({ number: v.number(), name: v.string(), city: v.string(), state: v.string(), competing: v.boolean() }))
const matchFields = v.array(v.object({
  toaMatchKey: v.string(), matchName: v.string(), tournamentLevel: v.number(), playNumber: v.number(),
  scheduledTime: v.optional(v.string()), redTeamNumbers: v.array(v.number()), blueTeamNumbers: v.array(v.number()),
  redScore: v.optional(v.number()), blueScore: v.optional(v.number()),
}))

export const active = query({
  args: {},
  handler: async ctx => await ctx.db.query("events").withIndex("by_active", q => q.eq("active", true)).first(),
})

export const syncImportedEvent = internalMutation({
  args: { event: v.object(eventFields), teams: teamFields, matches: matchFields },
  handler: async (ctx, { event, teams, matches }) => {
    const allEvents = await ctx.db.query("events").collect()
    for (const prior of allEvents) if (prior.active && prior.code !== event.code) await ctx.db.patch(prior._id, { active: false })

    const existingEvent = await ctx.db.query("events").withIndex("by_code", q => q.eq("code", event.code)).first()
    const eventData = { ...event, active: true, source: "orange-alliance" as const, importedAt: Date.now() }
    if (existingEvent) await ctx.db.patch(existingEvent._id, eventData)
    else await ctx.db.insert("events", eventData)

    const existingTeams = await ctx.db.query("teams").withIndex("by_event", q => q.eq("eventCode", event.code)).collect()
    for (const prior of existingTeams) {
      if (prior.tags.includes("Demo roster")) await ctx.db.delete(prior._id)
      else await ctx.db.patch(prior._id, { competing: false, inEvent: false })
    }
    const teamsByNumber = new Map(existingTeams.filter(team => !team.tags.includes("Demo roster")).map(team => [team.number, team]))
    for (const team of teams) {
      const prior = teamsByNumber.get(team.number)
      if (prior) await ctx.db.patch(prior._id, { ...team, inEvent: true })
      else await ctx.db.insert("teams", { eventCode: event.code, ...team, inEvent: true, status: "Not scouted", tier: "Uncategorized", driver: 0, auto: 0, teleop: 0, tags: [] })
    }

    const existingMatches = await ctx.db.query("eventMatches").withIndex("by_event", q => q.eq("eventCode", event.code)).collect()
    for (const match of existingMatches) await ctx.db.delete(match._id)
    for (const match of matches) await ctx.db.insert("eventMatches", { eventCode: event.code, ...match })

    const allowedStations = new Set(robotStationsForSchedule(matches).map(station => station.key))
    const currentMatchKeys = new Set(matches.map(match => match.toaMatchKey))
    const eventAssignments = await ctx.db.query("scoutAssignments").withIndex("by_event", q => q.eq("eventCode", event.code)).collect()
    for (const assignment of eventAssignments) {
      if (!currentMatchKeys.has(assignment.matchKey) || (assignment.station && !allowedStations.has(assignment.station))) {
        await ctx.db.delete(assignment._id)
      }
    }
    for (const match of matches) {
      const assignments = await ctx.db.query("scoutAssignments").withIndex("by_event_match", q => q.eq("eventCode", event.code).eq("matchKey", match.toaMatchKey)).collect()
      for (const assignment of assignments) {
        if (!assignment.station) continue
        const teamNumber = teamAtRobotStation(assignment.station, match.redTeamNumbers, match.blueTeamNumbers)
        await ctx.db.patch(assignment._id, { teamNumber })
      }
    }
    return { eventCode: event.code, teamCount: teams.length, competingTeamCount: event.competingTeamCount, matchCount: matches.length }
  },
})
