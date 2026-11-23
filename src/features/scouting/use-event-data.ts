import { useQuery } from "convex/react"
import { ACTIVE_EVENT } from "../../lib/active-event"
import { getActiveEvent, getMatchReportSummary, listEventMatches, listTeams } from "../../lib/convex-api"

export function useEventData() {
  const event = useQuery(getActiveEvent)
  const eventCode = event?.code ?? ACTIVE_EVENT.code
  const activeEventResolved = event !== undefined
  const teams = useQuery(listTeams, activeEventResolved ? { eventCode } : "skip")
  const matches = useQuery(listEventMatches, activeEventResolved ? { eventCode } : "skip")
  const reports = useQuery(getMatchReportSummary, activeEventResolved ? { eventCode } : "skip")
  return { event, eventCode, activeEventResolved, teams, matches, reports }
}
