import { useEffect, useState } from "react"
import { useMutation, useQuery, useConvexAuth } from "convex/react"
import { useNavigate, useParams } from "react-router"
import { ChevronRight, ClipboardCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import { Card, CardContent } from "../../../components/ui/card"
import { Input } from "../../../components/ui/input"
import { ACTIVE_EVENT } from "../../../lib/active-event"
import { convexClient } from "../../../lib/convex"
import { getMyScoutProfile, listScoutAssignments, saveMatchReport } from "../../../lib/convex-api"
import { teamAtRobotStation } from "../../../../convex/scoutingOptions"
import { createMatchReportDraft, MATCH_SCOUT_TAGS, type MatchReportDraft } from "../../../../convex/scoutingOptions"
import { EventNotConnected, SectionHeading, Counter } from "../components"
import { useEventData } from "../use-event-data"

export function MatchPage() {
  return convexClient ? <ConvexMatchPage /> : <EventNotConnected />
}

function ConvexMatchPage() {
  const { event, eventCode, teams: eventTeams, matches } = useEventData()
  const { isAuthenticated } = useConvexAuth()
  const params = useParams()
  const navigate = useNavigate()
  const saveReport = useMutation(saveMatchReport)
  const assignments = useQuery(listScoutAssignments, isAuthenticated ? { eventCode } : "skip")
  const scoutProfile = useQuery(getMyScoutProfile, isAuthenticated ? {} : "skip")
  const [draft, setDraft] = useState<MatchReportDraft>(() => createMatchReportDraft())
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const matchRows = matches ?? []
  const matchIndex = matchRows.findIndex(match => match.toaMatchKey === params.matchNumber || String(match.playNumber) === params.matchNumber)
  const match = matchRows[matchIndex >= 0 ? matchIndex : 0]
  const matchTeamNumbers = match ? [...match.redTeamNumbers, ...match.blueTeamNumbers] : []
  const matchTeams = matchTeamNumbers.length
    ? matchTeamNumbers.map(number => eventTeams?.find(team => team.number === number && team.competing !== false)).filter((team): team is NonNullable<typeof team> => !!team)
    : eventTeams?.filter(team => team.competing !== false) ?? []
  const currentScoutAssignment = match && scoutProfile?.displayName
    ? assignments?.find(item => item.matchKey === match.toaMatchKey && item.scoutId === scoutProfile.ownerId)
      ?? assignments?.find(item => item.matchKey === match.toaMatchKey && !item.scoutId && item.scoutName.trim().toLocaleLowerCase() === scoutProfile.displayName.trim().toLocaleLowerCase())
    : undefined
  const assignedTeamNumber = match && currentScoutAssignment
    ? currentScoutAssignment.teamNumber ?? (currentScoutAssignment.station ? teamAtRobotStation(currentScoutAssignment.station, match.redTeamNumbers, match.blueTeamNumbers) : undefined)
    : undefined
  const selectableTeams = assignedTeamNumber === undefined ? [] : matchTeams.filter(team => team.number === assignedTeamNumber)
  const selectedTeam = selectableTeams.find(team => team.number === selectedTeamNumber) ?? selectableTeams[0]
  const ratingsValid = Number.isInteger(draft.driverRating) && draft.driverRating >= 1 && draft.driverRating <= 10 && Number.isInteger(draft.defenseRating) && draft.defenseRating >= 1 && draft.defenseRating <= 10

  useEffect(() => {
    setSelectedTeamNumber(null)
    setDraft(createMatchReportDraft())
  }, [eventCode, match?.toaMatchKey])

  useEffect(() => {
    if (!params.matchNumber || matches === undefined) return
    const routeHasMatch = matchRows.some(item => item.toaMatchKey === params.matchNumber || String(item.playNumber) === params.matchNumber)
    if (routeHasMatch) return
    const firstMatch = matchRows[0]
    navigate(firstMatch ? `/matches/${encodeURIComponent(firstMatch.toaMatchKey)}` : "/matches", { replace: true })
  }, [eventCode, matches, matchRows, navigate, params.matchNumber])

  const updateDraft = <K extends keyof MatchReportDraft>(key: K, value: MatchReportDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }
  const nextMatch = (direction: number) => {
    if (!matchRows.length) return
    const nextIndex = Math.min(matchRows.length - 1, Math.max(0, (matchIndex < 0 ? 0 : matchIndex) + direction))
    navigate(`/matches/${encodeURIComponent(matchRows[nextIndex].toaMatchKey)}`)
  }
  const submit = async () => {
    if (!isAuthenticated) {
      toast.info("Sign in to save scouting reports.")
      return
    }
    if (!match || !selectedTeam) {
      toast.error("Your account must be assigned to a robot for this match before submitting a report.")
      return
    }
    if (!ratingsValid) {
      toast.error("Ratings must be between 1 and 10.")
      return
    }
    setSaving(true)
    try {
      const notes = [draft.autoNotes && `Auto: ${draft.autoNotes}`, draft.teleopNotes && `Teleop: ${draft.teleopNotes}`, draft.endgameNotes && `Endgame: ${draft.endgameNotes}`].filter(Boolean).join("\n")
      await saveReport({
        eventCode,
        matchKey: match.toaMatchKey,
        matchNumber: match.playNumber || Math.max(1, matchIndex + 1),
        teamNumber: selectedTeam.number,
        autoHiveTips: draft.autoHiveTips,
        autoPark: draft.autoPark,
        autoLeave: draft.autoLeave,
        autoNotes: draft.autoNotes || undefined,
        teleopFlowers: draft.teleopHiveTips,
        teleopHiveTips: draft.teleopHiveTips,
        teleopNotes: draft.teleopNotes || undefined,
        endgamePark: draft.endgamePark,
        endgameFlowerPoints: draft.endgameFlowerPoints,
        endgameNotes: draft.endgameNotes || undefined,
        driverRating: draft.driverRating,
        defenseRating: draft.defenseRating,
        notes: notes || undefined,
        tags: draft.tags,
      })
      toast.success(`Report saved for team ${selectedTeam.number}. Returning to match scouting.`)
      navigate("/matches")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save match report")
    } finally {
      setSaving(false)
    }
  }

  if (!match) return <div className="page-stack narrow"><SectionHeading eyebrow={`MATCH SCOUTING · ${eventCode}`} title="Match schedule" description={`${event?.name ?? ACTIVE_EVENT.name} · ${event?.teamCount ?? eventTeams?.length ?? 0} teams · ${event?.competingTeamCount ?? eventTeams?.filter(team => team.competing).length ?? 0} competing`} /><div className="empty-state"><ClipboardCheck className="size-8" /><p>The Orange Alliance has not published matches for this event yet.</p></div></div>
  const teamMap = new Map((eventTeams ?? []).map(team => [team.number, team]))
  const yesNo = (label: string, value: boolean, onChange: (next: boolean) => void, positive = "Yes") => <div className="form-section"><div className="field-label"><span>{label}</span></div><div className="team-chip-row"><Button type="button" variant={value ? "ghost" : "secondary"} aria-pressed={!value} onClick={() => onChange(false)}>No {label.toLowerCase()}</Button><Button type="button" variant={value ? "secondary" : "ghost"} aria-pressed={value} onClick={() => onChange(true)}>{positive}</Button></div></div>
  const noteInput = (label: string, value: string, key: "autoNotes" | "teleopNotes" | "endgameNotes") => <div className="form-section"><div className="field-label"><span>{label}</span><span className="unit">Optional</span></div><Input value={value} onChange={event => updateDraft(key, event.target.value)} placeholder="Short observation..." /></div>

  return <div className="page-stack narrow">
    <SectionHeading eyebrow={`MATCH SCOUTING · ${eventCode}`} title={match.matchName} description={`${event?.name ?? ACTIVE_EVENT.name} · ${event?.teamCount ?? eventTeams?.length ?? 0} teams · ${event?.competingTeamCount ?? eventTeams?.filter(team => team.competing).length ?? 0} competing · ${matchRows.length} matches`} action={<div className="match-nav"><Button variant="ghost" onClick={() => nextMatch(-1)} disabled={matchIndex <= 0}>‹</Button><span>{matchIndex + 1} of {matchRows.length}</span><Button variant="ghost" onClick={() => nextMatch(1)} disabled={matchIndex >= matchRows.length - 1}>›</Button></div>} />
    <Card className="match-banner"><CardContent><div><span className="match-badge">{match.matchName}</span><strong>{match.scheduledTime ?? "Time TBD"}</strong><p>Red {match.redTeamNumbers.map(number => teamMap.get(number)?.name ?? number).join(" · ") || "alliance pending"} vs Blue {match.blueTeamNumbers.map(number => teamMap.get(number)?.name ?? number).join(" · ") || "alliance pending"}</p></div>{match.redScore !== undefined && match.blueScore !== undefined ? <Badge variant="success">{match.redScore} – {match.blueScore}</Badge> : <Badge variant="warning">Not played</Badge>}</CardContent></Card>
    <Card><CardContent>
      <div className="form-section"><div className="field-label"><span>Assigned robot</span><span className="required">{selectedTeam ? `Team ${selectedTeam.number}` : "Assignment required"}</span></div>{selectedTeam ? <div className="team-chip-row"><span className="team-chip selected"><i className={`alliance-dot ${match.redTeamNumbers.includes(selectedTeam.number) ? "red" : "blue"}`} />{selectedTeam.number} · {teamMap.get(selectedTeam.number)?.name ?? "Event team"}</span></div> : <p className="muted-copy">{!isAuthenticated ? "Sign in with your scout account to see the robot assigned to you." : scoutProfile === undefined || assignments === undefined ? "Loading your scout assignment…" : !scoutProfile.displayName ? "Your account has no scout nickname. Set one in the Prediction Pool profile before scouting." : `No robot is assigned to ${scoutProfile.displayName} for this match. Ask the assignment lead to assign your account nickname.`}</p>}{selectedTeam && <p className="muted-copy">Assigned scout: {currentScoutAssignment?.scoutName}. Your Convex account is recorded as the report author.</p>}</div>
      <div className="form-section"><div className="form-subheading"><span>Autonomous</span><span className="phase-line" /></div>
        {yesNo("Leave", draft.autoLeave, value => updateDraft("autoLeave", value), "Leave")}
        <div className="counter-grid"><Counter label="Hive tip count" value={draft.autoHiveTips} onChange={value => updateDraft("autoHiveTips", value)} /></div>
        {yesNo("Autonomous park", draft.autoPark, value => updateDraft("autoPark", value), "Park")}
        {noteInput("Auto notes", draft.autoNotes, "autoNotes")}
      </div>
      <div className="form-section"><div className="form-subheading"><span>Teleop</span><span className="phase-line" /></div><div className="counter-grid"><Counter label="Hive tip count" value={draft.teleopHiveTips} onChange={value => updateDraft("teleopHiveTips", value)} /></div>{noteInput("Teleop notes", draft.teleopNotes, "teleopNotes")}</div>
      <div className="form-section"><div className="form-subheading"><span>Endgame</span><span className="phase-line" /></div>
        {yesNo("Endgame park", draft.endgamePark, value => updateDraft("endgamePark", value), "Park")}
        <div className="counter-grid"><Counter label="Flower points" value={draft.endgameFlowerPoints} onChange={value => updateDraft("endgameFlowerPoints", value)} /></div>
        {noteInput("Endgame notes", draft.endgameNotes, "endgameNotes")}
      </div>
      <div className="form-section"><div className="form-subheading"><span>Ratings</span><span className="phase-line" /></div><div className="rating-grid"><label>Driver rating (1–10)<Input type="number" min="1" max="10" step="1" value={draft.driverRating} onChange={event => updateDraft("driverRating", event.target.value === "" ? 0 : Math.min(10, Math.max(1, Number(event.target.value))))} /></label><label>Defense rating (1–10)<Input type="number" min="1" max="10" step="1" value={draft.defenseRating} onChange={event => updateDraft("defenseRating", event.target.value === "" ? 0 : Math.min(10, Math.max(1, Number(event.target.value))))} /></label></div>{!ratingsValid && <p className="auth-error rating-validation-note" role="alert">Enter a whole number from 1 to 10 for both ratings before submitting.</p>}</div>
      <div className="form-section"><div className="form-subheading"><span>Tags</span><span className="unit">Select all that apply</span></div><div className="team-chip-row">{MATCH_SCOUT_TAGS.map(tag => { const active = draft.tags.includes(tag); return <Button key={tag} type="button" variant={active ? "secondary" : "ghost"} aria-pressed={active} onClick={() => updateDraft("tags", active ? draft.tags.filter(value => value !== tag) : [...draft.tags, tag])}>{tag}</Button> })}</div></div>
      <div className="form-footer"><p className="autosave"><span className="save-dot" /> {eventCode} · {match.matchName}</p><Button onClick={() => void submit()} disabled={saving || !selectedTeam || !isAuthenticated || !ratingsValid}>{saving ? "Saving…" : "Submit match report"}<ChevronRight className="size-4" /></Button></div>
    </CardContent></Card>
  </div>
}
