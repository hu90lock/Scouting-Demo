import { useEffect, useState } from "react"
import { useMutation } from "convex/react"
import { ChevronRight, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../../../components/ui/button"
import { Card, CardContent } from "../../../components/ui/card"
import { Input } from "../../../components/ui/input"
import { ACTIVE_EVENT } from "../../../lib/active-event"
import { convexClient } from "../../../lib/convex"
import { savePitReport, type ConvexTeam } from "../../../lib/convex-api"
import { createPitReportDraft, DRIVE_TRAIN_OPTIONS, INTAKE_TYPE_OPTIONS, MOTOR_TYPE_OPTIONS, PIT_CAPABILITY_OPTIONS, type PitReportDraft } from "../../../../convex/scoutingOptions"
import { EventNotConnected, Modal, SectionHeading } from "../components"
import { useEventData } from "../use-event-data"

export function PitPage() {
  return convexClient ? <ConvexPitPage /> : <EventNotConnected />
}

function ConvexPitPage() {
  const { event, eventCode, teams: eventTeams } = useEventData()
  const savePit = useMutation(savePitReport)
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<PitReportDraft>(() => createPitReportDraft())
  const [saving, setSaving] = useState(false)
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null)
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const competingTeams = eventTeams?.filter(team => team.competing !== false) ?? []
  const selectedTeam = competingTeams.find(team => team.number === selectedTeamNumber) ?? competingTeams[0]

  useEffect(() => {
    if (selectedTeamNumber === null && competingTeams.length) setSelectedTeamNumber(competingTeams[0].number)
  }, [selectedTeamNumber, competingTeams])

  useEffect(() => {
    setSelectedTeamNumber(null)
    setStep(1)
    setDraft(createPitReportDraft())
  }, [eventCode])

  const updateDraft = <K extends keyof PitReportDraft>(key: K, value: PitReportDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }
  const toggleCapability = (capability: PitReportDraft["capabilities"][number], checked: boolean) => {
    updateDraft("capabilities", checked
      ? [...draft.capabilities, capability]
      : draft.capabilities.filter(value => value !== capability))
  }
  const save = async () => {
    if (!selectedTeam) {
      toast.error(`No teams are available for ${eventCode}. Import the event roster first.`)
      return
    }
    const numericValues = [draft.frameWidth, draft.frameLength, draft.totalMotors, draft.totalServos]
    if (numericValues.some(value => value.trim() !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      toast.error("Dimensions and hardware counts must be zero or greater.")
      return
    }
    if ([draft.totalMotors, draft.totalServos].some(value => value.trim() !== "" && !Number.isInteger(Number(value)))) {
      toast.error("Motor and servo counts must be whole numbers.")
      return
    }
    setSaving(true)
    try {
      await savePit({
        eventCode,
        teamNumber: selectedTeam.number,
        driveTrain: draft.driveTrain,
        frameWidth: parseOptionalNumber(draft.frameWidth),
        frameLength: parseOptionalNumber(draft.frameLength),
        totalMotors: parseOptionalNumber(draft.totalMotors),
        totalServos: parseOptionalNumber(draft.totalServos),
        intakeType: draft.intakeType,
        capabilities: draft.capabilities,
        motorType: draft.motorType,
      })
      toast.success("Pit report saved")
      setStep(1)
      setDraft(createPitReportDraft())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save pit report")
    } finally {
      setSaving(false)
    }
  }
  const nextStep = () => {
    if (step < 3) setStep(step + 1)
    else void save()
  }
  const teamCount = event?.teamCount ?? eventTeams?.length ?? 0
  const competingCount = event?.competingTeamCount ?? eventTeams?.filter(team => team.competing).length ?? 0

  return <div className="page-stack narrow">
    <SectionHeading eyebrow={`PIT SCOUTING · ${eventCode}`} title={step === 1 ? "Robot capability" : step === 2 ? "Hardware details" : "Review pit report"} description={`${event?.name ?? ACTIVE_EVENT.name} · ${teamCount} teams · ${competingCount} competing`} action={<span className="step-count">{step} of 3</span>} />
    <Card><CardContent>
      {step === 1 && <>
        <div className="form-section"><div className="field-label"><span>Team</span><span className="required">Required</span></div><Button type="button" variant="secondary" className="w-full justify-start team-select" onClick={() => setTeamPickerOpen(true)} disabled={!competingTeams.length}>{selectedTeam ? <><div className="team-avatar small">{String(selectedTeam.number).slice(-2)}</div><div><strong>{selectedTeam.number} · {selectedTeam.name}</strong><p>{selectedTeam.city}{selectedTeam.state ? `, ${selectedTeam.state}` : ""}</p></div><ChevronRight className="ml-auto size-4 text-muted" /></> : `No teams imported for ${eventCode}`}</Button></div>
        <div className="form-section"><div className="field-label"><span>Drive train type</span><span className="required">Required</span></div><div className="choice-grid">{DRIVE_TRAIN_OPTIONS.map(option => <ChoiceCard key={option} option={option} selected={draft.driveTrain === option} onSelect={() => updateDraft("driveTrain", option)} />)}</div></div>
        <div className="form-section two-fields"><NumberField label="Frame width" unit="inches" value={draft.frameWidth} onChange={value => updateDraft("frameWidth", value)} /><NumberField label="Frame length" unit="inches" value={draft.frameLength} onChange={value => updateDraft("frameLength", value)} /></div>
        <div className="form-section"><div className="field-label"><span>Robot capabilities</span><span className="unit">Select all that apply</span></div><div className="check-grid">{PIT_CAPABILITY_OPTIONS.map(option => <label className="check-card" key={option}><input type="checkbox" checked={draft.capabilities.includes(option)} onChange={event => toggleCapability(option, event.target.checked)} /><span>{option}</span></label>)}</div></div>
      </>}
      {step === 2 && <>
        <div className="form-section"><div className="field-label"><span>Type of motors</span><span className="required">Required</span></div><div className="choice-grid">{MOTOR_TYPE_OPTIONS.map(option => <ChoiceCard key={option} option={option} selected={draft.motorType === option} onSelect={() => updateDraft("motorType", option)} />)}</div></div>
        <div className="form-section two-fields"><NumberField label="Total motors" unit="count" value={draft.totalMotors} onChange={value => updateDraft("totalMotors", value)} /><NumberField label="Total servos" unit="count" value={draft.totalServos} onChange={value => updateDraft("totalServos", value)} /></div>
        <div className="form-section"><div className="field-label"><span>Intake type</span><span className="required">Required</span></div><div className="choice-grid">{INTAKE_TYPE_OPTIONS.map(option => <ChoiceCard key={option} option={option} selected={draft.intakeType === option} onSelect={() => updateDraft("intakeType", option)} />)}</div></div>
      </>}
      {step === 3 && <div className="review-stack"><div className="review-hero"><Sparkles className="size-5" /><div><strong>Ready to save</strong><p>Review the report before adding it to the {eventCode} scouting database.</p></div></div><div className="detail-list"><div><span>Team</span><strong>{selectedTeam ? `${selectedTeam.number} · ${selectedTeam.name}` : "No team selected"}</strong></div><div><span>Drive train</span><strong>{draft.driveTrain}</strong></div><div><span>Frame</span><strong>{draft.frameWidth} × {draft.frameLength} in</strong></div><div><span>Motor type</span><strong>{draft.motorType} · {draft.totalMotors} motors · {draft.totalServos} servos</strong></div><div><span>Intake</span><strong>{draft.intakeType}</strong></div><div><span>Capabilities</span><strong>{draft.capabilities.join(" · ") || "None selected"}</strong></div></div></div>}
      <div className="form-footer"><p className="autosave"><span className="save-dot" /> Draft for {selectedTeam ? `team ${selectedTeam.number}` : eventCode}</p><Button type="button" onClick={nextStep} disabled={saving}>{saving ? "Saving…" : step === 3 ? "Save pit report" : "Continue"}<ChevronRight className="size-4" /></Button></div>
    </CardContent></Card>
    {teamPickerOpen && <Modal title={`Choose a ${eventCode} team`} description={`${event?.teamCount ?? competingTeams.length} teams in this event roster.`} onClose={() => setTeamPickerOpen(false)}><div className="event-options">{competingTeams.map((team: ConvexTeam) => <button type="button" className="event-option" key={team.number} onClick={() => { setSelectedTeamNumber(team.number); setTeamPickerOpen(false) }}><span><strong>{team.number} · {team.name}</strong><small>{team.city}{team.state ? `, ${team.state}` : ""}</small></span><ChevronRight className="size-4" /></button>)}</div></Modal>}
  </div>
}

function ChoiceCard({ option, selected, onSelect }: { option: string; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`choice-card ${selected ? "selected" : ""}`}><span className="choice-radio" />{option}</button>
}

function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (value: string) => void }) {
  return <div><div className="field-label"><span>{label}</span><span className="unit">{unit}</span></div><Input type="number" min="0" step={unit === "inches" ? "0.1" : "1"} value={value} onChange={event => onChange(event.target.value)} /></div>
}

function parseOptionalNumber(value: string) {
  if (value.trim() === "") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
