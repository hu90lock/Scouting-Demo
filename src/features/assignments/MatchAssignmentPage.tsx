import { useEffect, useMemo, useState } from "react"
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react"
import { ClipboardCheck, Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Select } from "../../components/ui/select"
import { convexClient } from "../../lib/convex"
import { importOrangeAllianceTeams, listRegisteredScouts, listScoutAssignments, saveMatchScoutAssignments } from "../../lib/convex-api"
import { robotStationsForSchedule, teamAtRobotStation } from "../../../convex/scoutingOptions"
import { EventNotConnected, SectionHeading } from "../scouting/components"
import { useEventData } from "../scouting/use-event-data"

export function MatchAssignmentPage() {
  return convexClient ? <ConnectedMatchAssignmentPage /> : <EventNotConnected />
}

function ConnectedMatchAssignmentPage() {
  const { isAuthenticated } = useConvexAuth()
  const { event, eventCode, teams, matches } = useEventData()
  const savedAssignments = useQuery(listScoutAssignments, isAuthenticated ? { eventCode } : "skip")
  const registeredScouts = useQuery(listRegisteredScouts, isAuthenticated ? {} : "skip")
  const refreshEvent = useAction(importOrangeAllianceTeams)
  const saveAssignments = useMutation(saveMatchScoutAssignments)
  const [search, setSearch] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingMatch, setSavingMatch] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    setSearch("")
    setDrafts({})
  }, [eventCode])
  const teamNames = useMemo(() => new Map((teams ?? []).map(team => [team.number, team.name])), [teams])
  const savedBySlot = useMemo(() => {
    const bySlot = new Map<string, { scoutId?: string; scoutName: string }>()
    const robotStations = robotStationsForSchedule(matches ?? [])
    for (const item of savedAssignments ?? []) {
      if (item.station) {
        bySlot.set(`${item.matchKey}:${item.station}`, { scoutId: item.scoutId, scoutName: item.scoutName })
        continue
      }
      if (item.teamNumber === undefined) continue
      const match = matches?.find(row => row.toaMatchKey === item.matchKey)
      const station = match && robotStations.find(position => teamAtRobotStation(position.key, match.redTeamNumbers, match.blueTeamNumbers) === item.teamNumber)
      if (station) bySlot.set(`${item.matchKey}:${station.key}`, { scoutId: item.scoutId, scoutName: item.scoutName })
    }
    return bySlot
  }, [savedAssignments, matches])
  const scheduledMatches = matches ?? []
  const robotStations = useMemo(() => robotStationsForSchedule(scheduledMatches), [scheduledMatches])
  const slotsPerAlliance = robotStations.filter(station => station.alliance === "red").length
  const stationLabels = robotStations.map(station => station.label).join(", ")
  const matchesMissingRobotTeams = scheduledMatches.filter(match => match.redTeamNumbers.length < slotsPerAlliance || match.blueTeamNumbers.length < slotsPerAlliance)
  const matchingMatches = scheduledMatches.filter(match => {
    const haystack = `${match.matchName} ${match.toaMatchKey} ${[...match.redTeamNumbers, ...match.blueTeamNumbers].join(" ")}`.toLowerCase()
    return haystack.includes(search.trim().toLowerCase())
  })

  const saveMatch = async (matchKey: string) => {
    if (!isAuthenticated) {
      toast.info("Sign in to save scout assignments.")
      return
    }
    setSavingMatch(matchKey)
    try {
      const assignments = robotStations.map(station => ({
        station: station.key,
        scoutId: drafts[`${matchKey}:${station.key}`] ?? savedBySlot.get(`${matchKey}:${station.key}`)?.scoutId ?? registeredScouts?.find(scout => scout.scoutName.toLocaleLowerCase() === savedBySlot.get(`${matchKey}:${station.key}`)?.scoutName.toLocaleLowerCase())?.scoutId ?? "",
      }))
      await saveAssignments({ eventCode, matchKey, assignments })
      toast.success("Scout assignments saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save scout assignments")
    } finally {
      setSavingMatch(null)
    }
  }

  const refreshSchedule = async () => {
    setRefreshing(true)
    try {
      await refreshEvent({ eventCode: event?.toaKey ?? eventCode })
      toast.success(`Refreshed ${event?.name ?? eventCode} from The Orange Alliance`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh the event schedule")
    } finally {
      setRefreshing(false)
    }
  }

  return <div className="page-stack">
    <SectionHeading
      eyebrow={`SCOUT ASSIGNMENTS · ${eventCode}`}
      title="Assign scouts to matches"
      description={`Each scheduled match shows its participating robots. Assign one scout to each robot for ${event?.name ?? eventCode}.`}
      action={<div className="assignment-page-actions"><Badge variant="neutral">{scheduledMatches.length} matches</Badge><Button variant="secondary" onClick={() => void refreshSchedule()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh event schedule"}</Button></div>}
    />
    {matchesMissingRobotTeams.length > 0 && <Card><CardContent><p className="assignment-signin-note"><strong>{matchesMissingRobotTeams.length} matches have robot team numbers missing from the imported schedule.</strong> The {stationLabels} scout slots remain available. Refresh the active event to fill the matching team numbers from The Orange Alliance.</p></CardContent></Card>}
    {!isAuthenticated && <Card><CardContent><p className="muted-copy assignment-signin-note">Sign in to assign scouts and save assignments to Convex.</p></CardContent></Card>}
    <label className="search-wrap assignment-search"><Search className="size-4 list-search-icon" /><Input aria-label="Search matches" placeholder="Search by match or team number..." value={search} onChange={event => setSearch(event.target.value)} /></label>
    {matches === undefined ? <div className="empty-state"><ClipboardCheck className="size-8" /><p>Loading the {event?.name ?? eventCode} match schedule…</p></div> : matchingMatches.length ? <div className="assignment-page-list">{matchingMatches.map(match => {
      const knownTeamCount = match.redTeamNumbers.length + match.blueTeamNumbers.length
      return <Card className="assignment-match-card" key={match.toaMatchKey}>
        <CardHeader><div className="card-heading-row"><div><CardTitle>{match.matchName}</CardTitle><p className="muted-copy">{match.scheduledTime ?? "Time TBD"} · {knownTeamCount} of {robotStations.length} event robot slots identified</p></div><Button disabled={!isAuthenticated || savingMatch === match.toaMatchKey} onClick={() => void saveMatch(match.toaMatchKey)}>{savingMatch === match.toaMatchKey ? "Saving…" : "Save assignments"}</Button></div></CardHeader>
        <CardContent><div className="assignment-slot-grid">{robotStations.map(station => {
          const teamNumber = teamAtRobotStation(station.key, match.redTeamNumbers, match.blueTeamNumbers)
          const alliance = station.alliance === "red" ? "Red" : "Blue"
          const key = `${match.toaMatchKey}:${station.key}`
          const savedScout = savedBySlot.get(key)
          const legacyMatchedScoutId = savedScout && registeredScouts?.find(scout => scout.scoutName.toLocaleLowerCase() === savedScout.scoutName.toLocaleLowerCase())?.scoutId
          return <div className={`assignment-slot ${alliance.toLowerCase()}-assignment-slot`} key={key}>
            <span><strong>{station.label}{teamNumber ? ` · ${teamNumber}` : " · team pending"}</strong><small>{teamNumber ? teamNames.get(teamNumber) ?? "Event team" : "Robot assignment is saved by station"}</small></span>
            <Select aria-label={`${match.matchName}, ${station.label} scout`} value={drafts[key] ?? savedScout?.scoutId ?? legacyMatchedScoutId ?? ""} options={(registeredScouts ?? []).map(scout => ({ value: scout.scoutId, label: scout.scoutName }))} onValueChange={value => setDrafts(current => ({ ...current, [key]: value }))} placeholder={registeredScouts === undefined ? "Loading scouts…" : "Select scout account"} disabled={!isAuthenticated || registeredScouts === undefined || registeredScouts.length === 0} />
          </div>
        })}</div>{savedAssignments?.some(item => item.matchKey === match.toaMatchKey && item.station === undefined && item.teamNumber === undefined) && <p className="muted-copy">A legacy whole-match assignment exists for this match. New assignments are saved separately to each robot station.</p>}</CardContent>
      </Card>
    })}</div> : <div className="empty-state"><ClipboardCheck className="size-8" /><p>{scheduledMatches.length ? "No matches or teams match your search." : `No scheduled matches are published for ${eventCode} yet. Refresh the active event schedule to check The Orange Alliance.`}</p></div>}
  </div>
  }
