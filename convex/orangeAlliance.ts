import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

type ToaRecord = Record<string, unknown>

class OrangeAllianceError extends Error {
  constructor(readonly status: number, path: string) {
    super(status === 404 ? `Orange Alliance data was not found at /${path}.` : `Orange Alliance request failed (${status}) at /${path}.`)
    this.name = "OrangeAllianceError"
  }
}

async function fetchOrangeAlliance(path: string): Promise<unknown> {
  const key = process.env.TOA_AUTH_KEY?.trim()
  if (!key) throw new Error("Orange Alliance API is not configured. Add TOA_AUTH_KEY to the Convex deployment environment.")
  const response = await fetch(`https://theorangealliance.org/api/${path}`, {
    headers: { "Content-Type": "application/json", "X-TOA-Key": key, "X-Application-Origin": "Scoutline" },
  })
  if (!response.ok) throw new OrangeAllianceError(response.status, path)
  return await response.json()
}

function asRecords(value: unknown): ToaRecord[] {
  if (Array.isArray(value)) return value.filter(item => item && typeof item === "object") as ToaRecord[]
  return value && typeof value === "object" ? [value as ToaRecord] : []
}

function numberFrom(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function normalizeEventKey(code: string): string {
  const normalized = code.toUpperCase()
  if (normalized === "MXCOQ") return "2627-MEX-COQ"
  if (/^\d{4}-[A-Z0-9]+-[A-Z0-9]+$/.test(normalized)) return normalized
  throw new Error("Enter a FIRST event code supported by the app or the full Orange Alliance event key, such as 2627-MEX-COQ.")
}

function matchTeamNumbers(participants: ToaRecord[], matchKey: string) {
  const red: Array<{ teamNumber: number; position: number }> = []
  const blue: Array<{ teamNumber: number; position: number }> = []
  for (const participant of participants) {
    const candidateKey = String(participant.match_key ?? participant.matchKey ?? "")
    if (candidateKey && candidateKey !== matchKey) continue
    const team = participant.team ?? participant
    const teamNumber = numberFrom(participant.team_number ?? team.team_number ?? participant.team_key ?? team.team_key)
    if (!teamNumber) continue
    const stationValue = participant.match_participant_station ?? participant.station
    const stationNumber = typeof stationValue === "number" ? stationValue : Number.parseInt(String(stationValue ?? ""), 10)
    const alliance = String(participant.alliance ?? participant.alliance_color ?? participant.match_participant_alliance ?? stationValue ?? "").toLowerCase()
    const textualPosition = stationValue == null ? undefined : Number.parseInt(alliance.match(/[123]/)?.[0] ?? "", 10)
    const position = Number.isFinite(stationNumber) && stationNumber > 0 ? stationNumber % 10 : Number.isFinite(textualPosition) && textualPosition > 0 ? textualPosition : undefined
    if (alliance.includes("red") || [11, 12, 13].includes(stationNumber)) {
      if (!red.some(item => item.teamNumber === teamNumber)) red.push({ teamNumber, position: position ?? red.length + 1 })
    } else if (alliance.includes("blue") || [21, 22, 23].includes(stationNumber)) {
      if (!blue.some(item => item.teamNumber === teamNumber)) blue.push({ teamNumber, position: position ?? blue.length + 1 })
    }
  }
  const byStation = (a: { position: number; teamNumber: number }, b: { position: number; teamNumber: number }) => a.position - b.position || a.teamNumber - b.teamNumber
  return { redTeamNumbers: red.sort(byStation).map(item => item.teamNumber), blueTeamNumbers: blue.sort(byStation).map(item => item.teamNumber) }
}

export const importEvent = action({
  args: { eventCode: v.string() },
  handler: async (ctx, { eventCode }) => {
    const inputCode = eventCode.trim().toUpperCase()
    if (!/^[A-Z0-9-]{3,40}$/.test(inputCode)) throw new Error("Enter a valid FIRST event code or Orange Alliance event key.")
    const toaKey = normalizeEventKey(inputCode)

    const [eventResult, teamResult, matchResult, participantResult] = await Promise.all([
      fetchOrangeAlliance(`event/${encodeURIComponent(toaKey)}`),
      fetchOrangeAlliance(`event/${encodeURIComponent(toaKey)}/teams`),
      fetchOrangeAlliance(`event/${encodeURIComponent(toaKey)}/matches`),
      fetchOrangeAlliance(`event/${encodeURIComponent(toaKey)}/matches/participants`).catch(error => {
        if (error instanceof OrangeAllianceError && error.status === 404) return []
        throw error
      }),
    ])
    const event = asRecords(eventResult)[0]
    if (!event) throw new Error(`Orange Alliance returned no event metadata for ${toaKey}.`)

    const code = String(event.first_event_code || inputCode).toUpperCase()
    const teamEntries = asRecords(teamResult)
    const teams = teamEntries.map((entry, index) => {
      const team = (entry.team ?? entry) as ToaRecord
      const number = numberFrom(entry.team_number ?? team.team_number ?? entry.team_key ?? team.team_key)
      if (!number) throw new Error(`Orange Alliance roster entry ${index + 1} has no numeric team number. The event was not imported.`)
      return {
        number,
        name: String(team.team_name_short || team.team_name_long || `Team ${number}`),
        city: String(team.city ?? ""),
        state: String(team.state_prov ?? ""),
        competing: entry.is_active !== false,
      }
    })

    const matchRecords = asRecords(matchResult)
    const participants = asRecords(participantResult)
    const matches = matchRecords.map((match, index) => {
      const matchKey = String(match.match_key ?? "")
      const tournamentLevel = Number(match.tournament_level)
      const playNumber = Number(match.play_number)
      if (!matchKey || match.tournament_level == null || match.play_number == null || !Number.isFinite(tournamentLevel) || !Number.isFinite(playNumber)) {
        throw new Error(`Orange Alliance match ${index + 1} is missing its match key or schedule numbers. The event was not imported.`)
      }
      const nestedParticipants = Array.isArray(match.participants) ? match.participants as ToaRecord[] : []
      const teamsInMatch = matchTeamNumbers([...participants, ...nestedParticipants], matchKey)
      const score = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined
      return {
        toaMatchKey: matchKey,
        matchName: String(match.match_name || matchKey || "Match"),
        tournamentLevel,
        playNumber,
        scheduledTime: typeof match.scheduled_time === "string" ? match.scheduled_time : undefined,
        ...teamsInMatch,
        redScore: score(match.red_score),
        blueScore: score(match.blue_score),
      }
    })

    const synced = await ctx.runMutation(internal.events.syncImportedEvent, {
      event: {
        code,
        toaKey,
        name: String(event.event_name || code),
        seasonKey: String(event.season_key || toaKey.slice(0, 4)),
        startDate: typeof event.start_date === "string" ? event.start_date : undefined,
        endDate: typeof event.end_date === "string" ? event.end_date : undefined,
        city: typeof event.city === "string" ? event.city : undefined,
        stateProv: typeof event.state_prov === "string" ? event.state_prov : undefined,
        country: typeof event.country === "string" ? event.country : undefined,
        teamCount: teams.length,
        competingTeamCount: teams.filter(team => team.competing).length,
        matchCount: matches.length,
      },
      teams,
      matches,
    })
    return { ...synced, toaKey, cached: false }
  },
})
