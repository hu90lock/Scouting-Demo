import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { components } from "./_generated/api"
import { MATCH_SCOUT_TAGS, teamAtRobotStation } from "./scoutingOptions"

const args = {
  eventCode: v.string(),
  matchKey: v.string(),
  matchNumber: v.number(),
  teamNumber: v.number(),
  autoHiveTips: v.number(),
  autoCycles: v.optional(v.number()),
  autoPark: v.boolean(),
  autoLeave: v.optional(v.boolean()),
  autoNotes: v.optional(v.string()),
  teleopFlowers: v.number(),
  teleopHiveTips: v.optional(v.number()),
  teleopCycles: v.optional(v.number()),
  teleopNotes: v.optional(v.string()),
  endgamePark: v.optional(v.boolean()),
  endgameFlowerPoints: v.optional(v.number()),
  endgameNotes: v.optional(v.string()),
  defenseEvents: v.optional(v.number()),
  driverRating: v.number(),
  defenseRating: v.number(),
  notes: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
}

export const byMatch = query({
  args: { eventCode: v.string(), matchNumber: v.number() },
  handler: async (ctx, input) => await ctx.db.query("matchReports").withIndex("by_event_match", q => q.eq("eventCode", input.eventCode).eq("matchNumber", input.matchNumber)).collect(),
})

export const byTeam = query({
  args: { eventCode: v.string(), teamNumber: v.number() },
  handler: async (ctx, input) => await ctx.db.query("matchReports").withIndex("by_event_team", q => q.eq("eventCode", input.eventCode).eq("teamNumber", input.teamNumber)).collect(),
})

export const summary = query({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    const reports = await ctx.db.query("matchReports").withIndex("by_event", q => q.eq("eventCode", eventCode)).collect()
    return { count: reports.length, scoutedTeamCount: new Set(reports.map(report => report.teamNumber)).size }
  },
})

export const save = mutation({
  args,
  handler: async (ctx, input) => {
    const identity = await ctx.auth.getUserIdentity()
    const userId = await getAuthUserId(ctx)
    if (!identity || !userId) throw new Error("Sign in to save a match report.")

    if (!Number.isInteger(input.matchNumber) || input.matchNumber < 1 || !Number.isInteger(input.teamNumber) || input.teamNumber < 1) {
      throw new Error("Choose a valid scheduled match and team.")
    }
    const match = await ctx.db.query("eventMatches").withIndex("by_event_key", q => q.eq("eventCode", input.eventCode).eq("toaMatchKey", input.matchKey)).first()
    if (!match || match.playNumber !== input.matchNumber) throw new Error("This scheduled match does not match the selected event.")
    if (![...match.redTeamNumbers, ...match.blueTeamNumbers].includes(input.teamNumber)) throw new Error("The selected team is not participating in this match.")
    const team = await ctx.db.query("teams").withIndex("by_event_number", q => q.eq("eventCode", input.eventCode).eq("number", input.teamNumber)).first()
    if (!team || team.competing === false) throw new Error("The selected team is not in this event's competing roster.")

    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId })
    const scoutOwnerIds = new Set([userId, ...sessions.map(session => session.sessionId)])
    const scoutProfiles = await ctx.db.query("scoutProfiles").collect()
    const profile = scoutProfiles.find(row => row.ownerId === userId) ?? scoutProfiles.find(row => scoutOwnerIds.has(row.ownerId))
    if (!profile?.displayName.trim()) throw new Error("Set a scout nickname before submitting a match report.")
    const assignments = await ctx.db.query("scoutAssignments").withIndex("by_event_match", q => q.eq("eventCode", input.eventCode).eq("matchKey", input.matchKey)).collect()
    const myAssignment = assignments.find(assignment => assignment.scoutId === userId)
      ?? assignments.find(assignment => assignment.scoutId !== undefined && scoutOwnerIds.has(assignment.scoutId))
      ?? assignments.find(assignment => !assignment.scoutId && assignment.scoutName.trim().toLocaleLowerCase() === profile.displayName.trim().toLocaleLowerCase())
    const assignedTeamNumber = myAssignment?.teamNumber ?? (myAssignment?.station
      ? teamAtRobotStation(myAssignment.station, match.redTeamNumbers, match.blueTeamNumbers)
      : undefined)
    if (assignedTeamNumber === undefined) throw new Error("You are not assigned to a robot for this match.")
    if (assignedTeamNumber !== input.teamNumber) throw new Error("You can only submit a report for the robot assigned to your scout nickname.")

    const counters = [input.autoHiveTips, input.autoCycles ?? 0, input.teleopHiveTips ?? input.teleopFlowers, input.teleopCycles ?? 0, input.endgameFlowerPoints ?? 0, input.defenseEvents ?? 0]
    if (counters.some(value => !Number.isInteger(value) || value < 0)) throw new Error("Scoring counts must be non-negative whole numbers.")
    if ([input.driverRating, input.defenseRating].some(value => !Number.isInteger(value) || value < 1 || value > 10)) throw new Error("Ratings must be whole numbers from 1 to 10.")
    const tags = input.tags ?? []
    if (tags.some(tag => !MATCH_SCOUT_TAGS.some(option => option === tag))) throw new Error("One or more report tags are invalid.")
    const notes = [input.notes, input.autoNotes, input.teleopNotes, input.endgameNotes]
    if (notes.some(note => note !== undefined && note.length > 500)) throw new Error("Each scouting note must be 500 characters or fewer.")

    const reportsForMatch = await ctx.db.query("matchReports").withIndex("by_event_match_key", q => q.eq("eventCode", input.eventCode).eq("matchKey", input.matchKey)).collect()
    const scoutReport = reportsForMatch.find(report => scoutOwnerIds.has(report.scoutId))
    if (scoutReport && scoutReport.teamNumber !== input.teamNumber) {
      throw new Error("Each scout can submit one robot per match. You already have a report for another team in this match.")
    }

    const submittedAt = Date.now()
    const value = { ...input, tags, scoutId: userId, submittedAt }
    const id = scoutReport ? scoutReport._id : await ctx.db.insert("matchReports", value)
    if (scoutReport) await ctx.db.patch(scoutReport._id, value)

    const reports = await ctx.db.query("matchReports").withIndex("by_event_team", q => q.eq("eventCode", input.eventCode).eq("teamNumber", input.teamNumber)).collect()
    const previous = reports.filter(report => report._id !== id)
    const average = (values: number[]) => values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0
    await ctx.db.patch(team._id, {
      status: "Scouted",
      driver: average([...previous.map(report => report.driverRating), input.driverRating]),
      auto: average([...previous.map(report => report.autoHiveTips), input.autoHiveTips]),
      teleop: average([...previous.map(report => report.teleopHiveTips ?? report.teleopFlowers), input.teleopHiveTips ?? input.teleopFlowers]),
    })
    return id
  },
})
