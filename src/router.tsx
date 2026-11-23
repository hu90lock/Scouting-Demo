import { useEffect, useRef, useState, type FormEvent } from "react"
import { useTheme } from "next-themes"
import { createBrowserRouter, Link, NavLink, Outlet, useNavigate, useParams } from "react-router"
import { Activity, ArrowLeft, BarChart3, Bot, ChevronRight, ClipboardCheck, ClipboardList, GripVertical, LayoutDashboard, ListChecks, Menu, Moon, Plus, Search, Sparkles, Sun, Target, UserRoundCog, Users, X, Zap } from "lucide-react"
import { Button } from "./components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Badge } from "./components/ui/badge"
import { Input } from "./components/ui/input"
import { toast } from "sonner"
import { useAction, useMutation, useQuery } from "convex/react"
import { convexClient } from "./lib/convex"
import { ensureMxcoqDemo, getActiveEvent, getEventWorkbook, getPitReport, getTeam, getTeamMatchReports, getPrimaryPickList, getPredictionLeaderboard, getMyScoutProfile, setMyScoutProfile, importOrangeAllianceTeams, listMyPickLists, savePickList, savePrimaryPickList, unlockPrimaryPickList } from "./lib/convex-api"
import { useConvexAuth } from "convex/react"
import { useSignInWithUsernamePassword, useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { authApi } from "./lib/auth-api"
import { ACTIVE_EVENT } from "./lib/active-event"
import { EventNotConnected, Modal, SectionHeading } from "./features/scouting/components"
import { useEventData } from "./features/scouting/use-event-data"
import { PitPage } from "./features/scouting/pit/PitPage"
import { MatchPage } from "./features/scouting/match/MatchPage"
import { MatchAssignmentPage } from "./features/assignments/MatchAssignmentPage"
import { ProfilePage } from "./features/accounts/ProfilePage"

type Team = { number: number; name: string; city: string; state: string; competing?: boolean; inEvent?: boolean; pitScouted?: boolean; status: "Scouted" | "Not scouted"; tier: string; driver: number; auto: number; teleop: number; tags: string[] }
const navItems = [["Overview", "/", LayoutDashboard], ["Teams", "/teams", Users], ["Pit scouting", "/pit", Bot], ["Match scouting", "/matches", ClipboardCheck], ["Scout assignments", "/assignments", ClipboardList], ["Prediction pool", "/predictions", Target], ["Pick list", "/pick-list", ListChecks], ["Profile & accounts", "/profile", UserRoundCog]] as const

function ThemeToggle() { const { resolvedTheme, setTheme } = useTheme(); const dark = resolvedTheme === "dark"; return <button type="button" className="theme-toggle" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}<span>{dark ? "Light mode" : "Dark mode"}</span></button> }

function AppLayout() { return convexClient ? <ConvexAppLayout /> : <LocalAppLayout /> }
function LocalAppLayout() { return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Zap className="size-4" /></div><div><p className="brand-title">Scoutline</p><p className="brand-subtitle">Demo mode</p></div></div><div className="event-switcher"><span className="eyebrow">ACTIVE EVENT</span><div className="event-name">{ACTIVE_EVENT.name}</div><span className="event-key">{ACTIVE_EVENT.code} · Connect Convex to import live data</span></div><nav className="nav-list">{navItems.map(([label, path, Icon]) => <NavLink key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Icon className="size-[18px]" /><span>{label}</span></NavLink>)}</nav><div className="sidebar-footer"><ThemeToggle /><div className="user-chip"><div className="avatar">AS</div><div><p className="user-name">Demo Scout</p><p className="user-role">Temporary session</p></div></div></div></aside><div className="main-wrap"><header className="topbar"><div><p className="topbar-kicker">Connect Convex for Orange Alliance event data</p><h1 className="topbar-title"><CurrentTitle /></h1></div><div className="top-avatar">AS</div></header><main className="content"><Outlet /></main></div></div> }
function ConvexAppLayout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const activeEvent = useQuery(getActiveEvent)
  const eventCode = activeEvent?.code ?? ACTIVE_EVENT.code
  const ensureDemo = useMutation(ensureMxcoqDemo)
  const seedAttempted = useRef(false)
  useEffect(() => {
    if (activeEvent === null && !seedAttempted.current) {
      seedAttempted.current = true
      void ensureDemo({}).catch(() => toast.error("Could not load the MXCOQ demo event."))
    }
  }, [activeEvent, ensureDemo])
  const eventName = activeEvent?.name ?? ACTIVE_EVENT.name
  const seasonLabel = activeEvent?.seasonKey ? `${2000 + Number(activeEvent.seasonKey.slice(0, 2))}–${2000 + Number(activeEvent.seasonKey.slice(2))}` : "2026–27"
  const eventStats = activeEvent?.source === "demo" ? `${activeEvent.teamCount} demo teams · ${activeEvent.competingTeamCount ?? activeEvent.teamCount} simulated competitors` : `${activeEvent?.teamCount ?? 0} teams · ${activeEvent?.competingTeamCount ?? 0} competing · ${activeEvent?.matchCount ?? 0} matches`
  return <div className="app-shell">
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Zap className="size-4" /></div><div><p className="brand-title">Scoutline</p><p className="brand-subtitle">FTC {seasonLabel}</p></div><button className="mobile-close" onClick={() => setOpen(false)}><X className="size-5" /></button></div>
      <div className="event-switcher"><span className="eyebrow">ACTIVE EVENT</span><button className="event-name event-name-button" onClick={() => navigate("/teams")}>{eventName} <ChevronRight className="size-4" /></button><span className="event-key">{eventCode} · {eventStats}</span></div>
      <nav className="nav-list">{navItems.map(([label, path, Icon]) => <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Icon className="size-[18px]" /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-footer"><ThemeToggle /><div className="user-chip"><div className="avatar">AS</div><div><p className="user-name">Alex Scout</p><p className="user-role">Scout lead</p></div></div></div>
    </aside>
    <div className="main-wrap"><header className="topbar"><button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></button><div><p className="topbar-kicker">FTC {seasonLabel} · {eventCode} · {eventStats}</p><h1 className="topbar-title"><CurrentTitle /></h1></div><div className="topbar-actions"><button className="icon-button" aria-label="Show connection status" onClick={() => toast.info(`Convex connected · ${eventCode} · ${eventStats}`)}><Activity className="size-[18px]" /><span className="status-dot" /></button>{convexClient ? <AuthControls /> : <div className="top-avatar">AS</div>}</div></header><main className="content"><Outlet /></main></div>
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
  </div>
}
function CurrentTitle() { const path = location.pathname; return <>{path === "/" ? "Event command center" : path.startsWith("/teams") ? "Teams" : path.startsWith("/pit") ? "Pit scouting" : path.startsWith("/matches") ? "Match scouting" : path.startsWith("/assignments") ? "Scout assignments" : path.startsWith("/predictions") ? "Prediction pool" : path.startsWith("/profile") ? "Profile & accounts" : "Pick list"}</> }
function StatCard({ label, value, detail, icon: Icon, tone = "orange" }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: string }) { return <Card className={`stat-card tone-${tone}`}><CardContent><div className="stat-top"><span className="stat-label">{label}</span><div className="stat-icon"><Icon className="size-4" /></div></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></CardContent></Card> }
function AuthControls() { const { isAuthenticated } = useConvexAuth(); const { signOut } = useAuthActions(); const saveProfile = useMutation(setMyScoutProfile); const [open, setOpen] = useState(false); const [mode, setMode] = useState<"login" | "signup">("login"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [nickname, setNickname] = useState(""); const [error, setError] = useState<string | null>(null); const signIn = useSignInWithUsernamePassword(authApi); const signUp = useSignUpWithUsernamePassword(authApi); const submit = async (event: FormEvent) => { event.preventDefault(); setError(null); try { const result = mode === "login" ? await signIn.signIn({ username, password }) : await signUp.signUp({ username, password }); if (result.status !== "complete") setError("Unable to authenticate. Check your username and password."); else { if (mode === "signup") await saveProfile({ displayName: nickname }); setOpen(false); toast.success(mode === "login" ? "Signed in" : "Account created") } } catch (cause) { setError(cause instanceof Error ? cause.message : "Authentication failed.") } }; return <>{isAuthenticated ? <Button variant="secondary" onClick={() => void signOut().then(() => toast.success("Signed out")).catch(() => toast.error("Could not sign out"))}>Sign out</Button> : <Button variant="secondary" onClick={() => setOpen(true)}>Sign in</Button>}{open && <Modal title={mode === "login" ? "Sign in to Scoutline" : "Create your scout account"} description="Your personal pick lists and scouting work are saved to your Convex user account." onClose={() => setOpen(false)}><form className="modal-stack" onSubmit={submit}>{mode === "signup" && <label className="modal-label">Scout nickname<Input autoComplete="nickname" value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Name shown in match assignments" minLength={2} maxLength={40} required /></label>}<label className="modal-label">Username<Input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="alex-scout" required /></label><label className="modal-label">Password<Input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 10 characters" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<Button type="submit">{mode === "login" ? "Sign in" : "Create account"}</Button><button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null) }}>{mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button></form></Modal>}</> }
export function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const signIn = useSignInWithUsernamePassword(authApi)
  const signUp = useSignUpWithUsernamePassword(authApi)
  const saveProfile = useMutation(setMyScoutProfile)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setWorking(true)
    try {
      const result = mode === "login" ? await signIn.signIn({ username, password }) : await signUp.signUp({ username, password })
      if (result.status !== "complete") setError("Unable to authenticate. Check your username and password.")
      else if (mode === "signup") await saveProfile({ displayName: nickname })
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Authentication failed.") } finally { setWorking(false) }
  }
  return <main className="auth-screen"><div className="auth-panel"><div className="brand-mark auth-mark"><Zap className="size-5" /></div><p className="eyebrow accent">SCOUTLINE · FTC {ACTIVE_EVENT.season}</p><h1>{mode === "login" ? "Welcome back, scout" : "Create your scout account"}</h1><p>Sign in to access your team's event data and personal pick lists.</p><form className="auth-form" onSubmit={submit}>{mode === "signup" && <label className="modal-label">Scout nickname<Input autoComplete="nickname" value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Name shown in match assignments" minLength={2} maxLength={40} required /></label>}<label className="modal-label">Username<Input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="alex-scout" required /></label><label className="modal-label">Password<Input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 10 characters" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<Button type="submit" disabled={working}>{working ? "Signing in…" : mode === "login" ? "Sign in" : "Create account"}</Button></form><button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null) }}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button></div></main>
}
function Overview() { return convexClient ? <ConvexOverview /> : <EventNotConnected /> }
function ConvexOverview() {
  const navigate = useNavigate()
  const { event, eventCode, teams: eventTeams, matches, reports } = useEventData()
  const competingTeams = eventTeams?.filter(team => team.competing === true) ?? []
  const totalTeams = event?.teamCount ?? eventTeams?.length ?? 0
  const activeTeamCount = event?.competingTeamCount ?? competingTeams.length
  const demoCount = eventTeams?.filter(team => team.tags.includes("Demo roster")).length ?? 0
  const teamMap = new Map((eventTeams ?? []).map(team => [team.number, team]))
  const scoutedCount = reports?.scoutedTeamCount ?? 0
  const nextMatches = (matches ?? []).slice(0, 3)
  return <div className="page-stack">
    <div className="hero-card"><div><p className="eyebrow light">ACTIVE REGIONAL · {eventCode}</p><h2>{event?.name ?? ACTIVE_EVENT.name}</h2><p>{event?.city ? `${event.city}, ${event.stateProv ?? ""} · ` : ""}{event?.source === "demo" ? `${totalTeams} demo teams · ${activeTeamCount} simulated competitors · schedule not imported` : `${totalTeams} teams · ${activeTeamCount} competing · ${event?.matchCount ?? matches?.length ?? 0} matches from Orange Alliance`}</p><div className="hero-actions"><Button onClick={() => navigate(nextMatches[0] ? `/matches/${encodeURIComponent(nextMatches[0].toaMatchKey)}` : "/matches")}><ClipboardCheck className="size-4" /> {nextMatches.length ? "Scout next match" : "View match schedule"}</Button><Button variant="secondary" onClick={() => navigate("/teams")}><Users className="size-4" /> Browse teams</Button><EventExportButton eventCode={eventCode} eventName={event?.name ?? eventCode} /></div></div><div className="hero-orbit"><div className="orbit-inner"><Bot className="size-12" /></div></div></div>
    <div className="stats-grid"><StatCard label="Event teams" value={String(totalTeams)} detail={`${activeTeamCount} competing${event?.source === "demo" ? ` · ${demoCount} demo assignments` : " · Orange Alliance"}`} icon={Users} /><StatCard label="Teams scouted" value={`${scoutedCount} / ${activeTeamCount}`} detail="Teams with saved match reports" icon={ClipboardCheck} tone="blue" /><StatCard label="Event matches" value={String(event?.matchCount ?? matches?.length ?? 0)} detail="Schedule from Orange Alliance" icon={ListChecks} tone="purple" /><StatCard label="Match reports" value={String(reports?.count ?? 0)} detail="Saved in Convex" icon={Target} tone="green" /></div>
    <div className="two-column">
      <Card><CardHeader><div className="card-heading-row"><div><CardTitle>Team roster</CardTitle><p className="muted-copy">{event?.source === "demo" ? `Demo regional: ${totalTeams} Coahuila teams from the 2026 Mexico roster; ${activeTeamCount} simulated competitors.` : `${totalTeams} listed · ${activeTeamCount} competing at ${event?.name ?? ACTIVE_EVENT.name}`}</p></div><Button variant="ghost" onClick={() => navigate("/teams")}>View roster <ChevronRight className="size-4" /></Button></div></CardHeader><CardContent>{eventTeams?.length ? <div className="match-list">{eventTeams.slice(0, 5).map(team => <Link to={`/teams/${team.number}`} className="match-row" key={team.number}><div className="match-number">{team.number}</div><div className="match-teams"><strong>{team.name}</strong><span>{team.city}{team.state ? `, ${team.state}` : ""}</span></div><Badge variant={team.tags.includes("Demo roster") ? "warning" : team.competing === false ? "neutral" : team.status === "Scouted" ? "success" : "neutral"}>{team.tags.includes("Demo roster") ? "Demo competitor" : team.competing === false ? "Not competing" : `${team.status} · competing`}</Badge></Link>)}</div> : <div className="empty-state"><Users className="size-8" /><p>Import an event from The Orange Alliance to load its teams.</p></div>}</CardContent></Card>
      <Card><CardHeader><div className="card-heading-row"><div><CardTitle>Upcoming matches</CardTitle><p className="muted-copy">Live schedule and alliance teams from Orange Alliance</p></div><Button variant="ghost" onClick={() => navigate("/matches")}>Schedule <ChevronRight className="size-4" /></Button></div></CardHeader><CardContent>{nextMatches.length ? <div className="match-list">{nextMatches.map(match => <Link to={`/matches/${encodeURIComponent(match.toaMatchKey)}`} className="match-row" key={match.toaMatchKey}><div className="match-number">{match.matchName}</div><div className="match-teams"><span><i className="alliance-dot red" />{match.redTeamNumbers.map(n => teamMap.get(n)?.name ?? String(n)).join(" · ") || "Red alliance pending"}</span><span><i className="alliance-dot blue" />{match.blueTeamNumbers.map(n => teamMap.get(n)?.name ?? String(n)).join(" · ") || "Blue alliance pending"}</span></div><span className="match-time">{match.scheduledTime ?? "Time TBD"}</span><ChevronRight className="size-4 text-muted" /></Link>)}</div> : <div className="empty-state"><ClipboardCheck className="size-8" /><p>No match schedule has been published for {eventCode} yet.</p></div>}</CardContent></Card>
    </div>
  </div>
}
function EventExportButton({ eventCode, eventName }: { eventCode: string; eventName: string }) {
  const exportData = useQuery(getEventWorkbook, { eventCode })
  const download = async () => {
    if (!exportData) { toast.info("Event data is still loading. Try again in a moment."); return }
    try {
      const { downloadEventWorkbook } = await import("./lib/event-workbook")
      await downloadEventWorkbook(exportData, eventName, eventCode)
      toast.success("Excel workbook downloaded")
    } catch (error) {
      toast.error(error instanceof Error ? `Export failed: ${error.message}` : "Could not create the Excel workbook.")
    }
  }
  return <Button variant="secondary" onClick={download} disabled={exportData === undefined}><BarChart3 className="size-4" />{exportData === undefined ? "Loading export…" : "Export Excel"}</Button>
}
function TeamsDirectory({ sourceTeams, onImportEvent, eventName = ACTIVE_EVENT.name, eventCode = ACTIVE_EVENT.code, demoRoster = false, totalTeamCount, competingTeamCount }: { sourceTeams: Team[]; totalTeamCount?: number; competingTeamCount?: number; onImportEvent?: (code: string) => Promise<void>; eventName?: string; eventCode?: string; demoRoster?: boolean }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "competing" | "needs" | "picks">("all")
  const [importOpen, setImportOpen] = useState(false)
  const savedLists = useQuery(listMyPickLists, { eventCode })
  const myPickNumbers = new Set((savedLists ?? []).flatMap(saved => Object.values(saved.tiers).flat()))
  const [importCode, setImportCode] = useState<string>(eventCode)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const filtered = sourceTeams.filter(team => {
    const matchesSearch = `${team.number} ${team.name} ${team.city}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === "all" || (filter === "competing" && team.competing !== false) || (filter === "needs" && team.pitScouted !== true) || (filter === "picks" && myPickNumbers.has(team.number))
    return matchesSearch && matchesFilter
  })
  const chooseEvent = async (code: string) => { const normalized = code.trim().toUpperCase(); if (!normalized) return; setImportError(null); setImporting(true); try { if (!onImportEvent) throw new Error("Orange Alliance imports require a connected Convex deployment."); await onImportEvent(normalized); setImportCode(normalized); setImportOpen(false); toast.success(`Imported event ${normalized} from The Orange Alliance`) } catch (error) { const message = error instanceof Error ? error.message : "Could not import this event."; setImportError(message); toast.error(message) } finally { setImporting(false) } }
  return <div className="page-stack"><SectionHeading eyebrow={demoRoster ? "DEMO REGIONAL · FTC 2026–27" : "TEAM DIRECTORY"} title="All teams" description={demoRoster ? `${totalTeamCount ?? sourceTeams.length} demo teams from the 2026 Mexico FTC roster; ${competingTeamCount ?? sourceTeams.filter(team => team.competing !== false).length} simulated competitors, not official MXCOQ assignments.` : `Teams for ${eventName} (${eventCode}): ${totalTeamCount ?? sourceTeams.length} listed, ${competingTeamCount ?? sourceTeams.filter(team => team.competing !== false).length} competing.`} action={<Button onClick={() => setImportOpen(true)}><Sparkles className="size-4" /> Import event</Button>} /><div className="toolbar"><div className="search-wrap"><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search teams..." /><span className="shortcut">⌘ K</span></div><div className="filter-pills"><button onClick={() => setFilter("all")} className={`filter-pill ${filter === "all" ? "active" : ""}`}>All <span>{sourceTeams.length}</span></button><button onClick={() => setFilter("competing")} className={`filter-pill ${filter === "competing" ? "active" : ""}`}>Competing <span>{competingTeamCount ?? sourceTeams.filter(team => team.competing !== false).length}</span></button><button onClick={() => setFilter("needs")} className={`filter-pill ${filter === "needs" ? "active" : ""}`}>Needs scouting <span>{sourceTeams.filter(team => team.pitScouted !== true).length}</span></button><button onClick={() => setFilter("picks")} className={`filter-pill ${filter === "picks" ? "active" : ""}`}>My picks <span>{sourceTeams.filter(team => myPickNumbers.has(team.number)).length}</span></button></div></div><div className="team-grid">{filtered.map(team => <Link to={`/teams/${team.number}`} key={team.number}><Card className="team-card"><CardContent><div className="team-card-top"><div className="team-number">{team.number}</div><Badge variant={team.tags.includes("Demo roster") ? "warning" : team.competing === false ? "neutral" : team.status === "Scouted" ? "success" : "neutral"}>{team.tags.includes("Demo roster") ? "Demo competitor" : team.competing === false ? "Not competing" : `${team.status} · competing`}</Badge></div><h3>{team.name}</h3><p className="team-location">{team.city}, {team.state}</p><div className="team-metrics"><div><span>Driver</span><strong>{team.driver ? team.driver.toFixed(1) : "—"}</strong></div><div><span>Auto tips</span><strong>{team.auto || "—"}</strong></div><div><span>Tier</span><strong className="tier-text">{team.tier.replace("Tier ", "T")}</strong></div></div><div className="team-card-footer"><div className="tag-row">{team.tags.slice(0, 2).map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><ChevronRight className="size-4 text-muted" /></div></CardContent></Card></Link>)}</div>{filtered.length === 0 && <div className="empty-state"><Users className="size-8" /><p>{sourceTeams.length ? "No teams match this filter." : `No competing teams imported for ${eventCode} yet. Choose Import event to fetch the roster from The Orange Alliance.`}</p></div>}{importOpen && <Modal title="Import an event" description="Enter its FIRST event code or Orange Alliance key. The API key stays on the Convex server." onClose={() => setImportOpen(false)}><div className="modal-stack"><label className="modal-label">Event code<Input value={importCode} onChange={event => setImportCode(event.target.value.toUpperCase())} placeholder="e.g. MXCOQ or 2627-MEX-COQ" /></label><Button disabled={importing} onClick={() => void chooseEvent(importCode || eventCode)}>{importing ? "Importing from Orange Alliance…" : "Import teams and matches"}</Button>{importError && <p className="auth-error" role="alert">{importError}</p>}<div className="modal-divider"><span>or import the current regional</span></div><div className="event-options"><button className="event-option" disabled={importing} onClick={() => void chooseEvent(eventCode)}><span><strong>{eventName}</strong><small>{eventCode} · FTC season {ACTIVE_EVENT.season}</small></span><ChevronRight className="size-4" /></button></div></div></Modal>}</div>
}
function TeamsPage() { return convexClient ? <ConvexTeamsPage /> : <EventNotConnected /> }
function ConvexTeamsPage() { const { event, eventCode, teams: eventTeams } = useEventData(); const importTeams = useAction(importOrangeAllianceTeams); const importEvent = async (code: string) => { await importTeams({ eventCode: code }) }; const demoRoster = eventTeams?.some(team => team.tags.includes("Demo roster")) ?? false; return <TeamsDirectory key={eventCode} sourceTeams={eventTeams ?? []} eventName={event?.name ?? ACTIVE_EVENT.name} eventCode={eventCode} onImportEvent={importEvent} demoRoster={demoRoster} totalTeamCount={event?.teamCount} competingTeamCount={event?.competingTeamCount} /> }
function TeamDetail() { return convexClient ? <ConvexTeamDetail /> : <EventNotConnected /> }
function ConvexTeamDetail() {
  const { event, eventCode } = useEventData()
  const navigate = useNavigate()
  const params = useParams()
  const teamNumber = Number(params.teamNumber)
  const team = useQuery(getTeam, { eventCode, teamNumber: Number.isFinite(teamNumber) ? teamNumber : -1 })
  const pit = useQuery(getPitReport, { eventCode, teamNumber: Number.isFinite(teamNumber) ? teamNumber : -1 })
  const reports = useQuery(getTeamMatchReports, { eventCode, teamNumber: Number.isFinite(teamNumber) ? teamNumber : -1 })
  if (team === undefined) return <div className="empty-state">Loading team from {event?.name ?? ACTIVE_EVENT.name}…</div>
  if (team === null) return <div className="empty-state"><Users className="size-8" /><p>Team {params.teamNumber} is not on the current {eventCode} roster.</p><Link to="/teams" className="back-link">Return to teams</Link></div>
  return <div className="page-stack">
    <Link to="/teams" className="back-link"><ArrowLeft className="size-4" /> Back to {eventCode} teams</Link>
    <div className="profile-header"><div className="team-avatar">{String(team.number).slice(-2)}</div><div><p className="eyebrow accent">{eventCode} TEAM PROFILE</p><h2>{team.number} · {team.name}</h2><p>{team.city}{team.state ? `, ${team.state}` : ""} · <Badge variant={team.competing === false ? "neutral" : team.status === "Scouted" ? "success" : "neutral"}>{team.competing === false ? "Not competing" : `${team.status} · competing`}</Badge></p></div><div className="profile-actions"><Button variant="secondary" onClick={() => navigate("/matches")}><ClipboardCheck className="size-4" /> New match report</Button><Button onClick={() => navigate("/pick-list")}><ListChecks className="size-4" /> View pick list</Button></div></div>
    <div className="stats-grid compact"><StatCard label="Driver rating" value={team.driver ? `${team.driver.toFixed(1)}/10` : "—"} detail="from Convex scouting reports" icon={Activity} /><StatCard label="Auto score" value={team.auto ? String(team.auto) : "—"} detail="from event reports" icon={Zap} tone="blue" /><StatCard label="Teleop score" value={team.teleop ? String(team.teleop) : "—"} detail="from event reports" icon={BarChart3} tone="purple" /><StatCard label="Current tier" value={team.tier.replace("Uncategorized", "Uncat.")} detail="pick list" icon={ListChecks} tone="green" /></div>
    <div className="two-column"><Card><CardHeader><CardTitle>Pit scouting</CardTitle></CardHeader><CardContent>{pit ? <div className="detail-list"><div><span>Drive train</span><strong>{pit.driveTrain || "—"}</strong></div><div><span>Frame size</span><strong>{pit.frameWidth ?? "—"} × {pit.frameLength ?? "—"} in</strong></div><div><span>Motor type</span><strong>{pit.motorType ?? "—"}</strong></div><div><span>Capabilities</span><strong>{pit.capabilities.join(" · ") || "—"}</strong></div></div> : <div className="empty-state"><Bot className="size-8" /><p>No pit report saved for team {team.number}.</p><Button onClick={() => navigate("/pit")}>Start pit scouting</Button></div>}</CardContent></Card><Card><CardHeader><div className="card-heading-row"><CardTitle>Match reports</CardTitle><Badge variant="neutral">{reports?.length ?? 0}</Badge></div></CardHeader><CardContent>{reports?.length ? <div className="report-list">{reports.map(report => <div className="report-row" key={`${report.matchNumber}-${report.submittedAt}`}><div className="report-match">Q{report.matchNumber}</div><div><strong>{report.notes || `Scout report for ${team.number}`}</strong><p>Scout {report.scoutId} · {new Date(report.submittedAt).toLocaleDateString()}</p></div><span className="rating-pill">{report.driverRating.toFixed(1)}</span></div>)}</div> : <div className="empty-state"><ClipboardCheck className="size-8" /><p>No match reports for this team yet.</p></div>}</CardContent></Card></div>
  </div>
}
function PredictionsPage() { return convexClient ? <ConvexPredictionsPage /> : <EventNotConnected /> }
function ConvexPredictionsPage() {
  const { event, eventCode } = useEventData()
  const leaderboard = useQuery(getPredictionLeaderboard, { eventCode })
  const myProfile = useQuery(getMyScoutProfile, {})
  const saveProfile = useMutation(setMyScoutProfile)
  const { isAuthenticated } = useConvexAuth()
  const [displayName, setDisplayName] = useState("")
  const [savingName, setSavingName] = useState(false)
  useEffect(() => setDisplayName(myProfile?.displayName ?? ""), [myProfile?.displayName])
  const correct = (leaderboard ?? []).reduce((total, scout) => total + scout.correct, 0)
  const incorrect = (leaderboard ?? []).reduce((total, scout) => total + scout.incorrect, 0)
  const resolved = correct + incorrect
  const accuracy = resolved ? Math.round(correct / resolved * 100) : 0
  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    setSavingName(true)
    try {
      await saveProfile({ displayName })
      toast.success("Scout name saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save scout name")
    } finally {
      setSavingName(false)
    }
  }
  return <div className="page-stack">
    <SectionHeading eyebrow={`PREDICTION POOL · ${eventCode}`} title="Scouter rankings" description={`Prediction results for ${event?.name ?? eventCode}. Only matches with published scores count as correct or incorrect.`} action={<div className="score-chip"><BarChart3 className="size-4" /> {leaderboard?.length ?? 0} scouters</div>} />
    <Card className="scout-name-card"><CardContent><form className="scout-name-form" onSubmit={event => { void saveName(event) }}><div><strong>Your leaderboard name</strong><p className="muted-copy">Choose the name shown beside your predictions.</p></div><Input aria-label="Your leaderboard name" autoComplete="name" maxLength={40} minLength={2} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Enter your scout name" disabled={!isAuthenticated} /><Button type="submit" disabled={!isAuthenticated || savingName || displayName.trim().length < 2}>{savingName ? "Saving…" : "Save name"}</Button></form>{!isAuthenticated && <p className="muted-copy scout-name-auth-note">Sign in to set your leaderboard name. The rankings remain visible.</p>}</CardContent></Card>
    <Card><CardHeader><div className="card-heading-row"><div><CardTitle>Prediction leaderboard</CardTitle><p className="muted-copy">Correct picks rank first; fewer incorrect picks break ties.</p></div><BarChart3 className="size-5 text-accent" /></div></CardHeader><CardContent>{leaderboard === undefined ? <div className="empty-state">Loading scouter rankings…</div> : leaderboard.length ? <div className="leaderboard-table-wrap"><table className="leaderboard-table"><thead><tr><th scope="col">Rank</th><th scope="col">Scout name</th><th scope="col">Correct predictions</th><th scope="col">Incorrect predictions</th></tr></thead><tbody>{leaderboard.map(scout => <tr key={`${scout.rank}-${scout.scoutName}`}><td><span className={`rank-number ${scout.rank <= 3 ? "top-rank" : ""}`}>{String(scout.rank).padStart(2, "0")}</span></td><th scope="row">{scout.scoutName}</th><td className="correct-count">{scout.correct}</td><td className="incorrect-count">{scout.incorrect}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Target className="size-8" /><p>No predictions have been recorded for {eventCode} yet.</p></div>}</CardContent></Card>
    <Card><CardHeader><div className="card-heading-row"><div><CardTitle>Overall prediction accuracy</CardTitle><p className="muted-copy">Correct predictions as a share of all predictions with published results.</p></div></div></CardHeader><CardContent><div className="prediction-accuracy-chart"><div className="prediction-pie" role="img" aria-label={`${accuracy}% correct predictions`} style={{ background: resolved ? `conic-gradient(var(--green) 0 ${accuracy}%, #e87872 ${accuracy}% 100%)` : "conic-gradient(var(--border) 0 100%)" }}><div className="prediction-pie-center"><strong>{resolved ? `${accuracy}%` : "—"}</strong><span>correct</span></div></div><div className="prediction-chart-legend"><div><i className="legend-dot correct-dot" /><span>Correct predictions</span><strong>{correct}</strong></div><div><i className="legend-dot incorrect-dot" /><span>Incorrect predictions</span><strong>{incorrect}</strong></div><p>{resolved ? `${resolved} predictions scored across completed matches.` : "The chart will populate when match scores and predictions are available."}</p></div></div></CardContent></Card>
  </div>
}
function PickListBoard({ eventTeams, eventCode, savedLists, primaryAccess, onPersist, onPrimaryPersist, onUnlockPrimary }: { eventTeams: Team[]; eventCode: string; savedLists?: Array<{ listName: string; tiers: Record<string, number[]> }>; primaryAccess?: { unlocked: boolean; tiers: Record<string, number[]> | null; updatedAt: number | null }; onPersist?: (listName: string, columns: Record<string, Team[]>) => Promise<unknown> | unknown; onPrimaryPersist?: (columns: Record<string, Team[]>) => Promise<unknown> | unknown; onUnlockPrimary?: (password: string) => Promise<void> }) {
  const baseColumns = (): Record<string, Team[]> => ({ "Tier 1": [], "Tier 2": [], "Tier 3": [], "Do Not Pick": [], Uncategorized: [...eventTeams] })
  const [lists, setLists] = useState<Record<string, Record<string, Team[]>>>(() => ({ "Alex's list": baseColumns(), "Primary list": baseColumns(), "Jordan's list": baseColumns() }))
  const [listName, setListName] = useState("Alex's list")
  const [drag, setDrag] = useState<Team | null>(null)
  const [listBrowserOpen, setListBrowserOpen] = useState(false)
  const [createListOpen, setCreateListOpen] = useState(false)
  const [listSearch, setListSearch] = useState("")
  const [newListName, setNewListName] = useState("")
  const [creatingList, setCreatingList] = useState(false)
  const [primaryPassword, setPrimaryPassword] = useState("")
  const [unlockingPrimary, setUnlockingPrimary] = useState(false)
  const columns = lists[listName] ?? baseColumns()

  useEffect(() => {
    if (!savedLists?.length) return
    const byNumber = new Map(eventTeams.map(team => [team.number, team]))
    setLists(current => {
      const next = { ...current }
      for (const saved of savedLists) {
        if (saved.listName === "Primary list") continue
        const savedColumns = baseColumns()
        for (const [tier, numbers] of Object.entries(saved.tiers)) savedColumns[tier] = (numbers ?? []).map(number => byNumber.get(number)).filter((team): team is Team => !!team)
        next[saved.listName] = savedColumns
      }
      return next
    })
  }, [savedLists, eventTeams])

  useEffect(() => {
    if (!primaryAccess?.unlocked) return
    const primaryColumns = baseColumns()
    const byNumber = new Map(eventTeams.map(team => [team.number, team]))
    for (const [tier, numbers] of Object.entries(primaryAccess.tiers ?? {})) primaryColumns[tier] = numbers.map(number => byNumber.get(number)).filter((team): team is Team => !!team)
    setLists(current => ({ ...current, "Primary list": primaryColumns }))
  }, [primaryAccess, eventTeams])

  const persistColumns = (name: string, next: Record<string, Team[]>) => {
    const action = name === "Primary list" ? onPrimaryPersist?.(next) : onPersist?.(name, next)
    void Promise.resolve(action).then(() => toast.success(name === "Primary list" ? "Primary list saved for this event" : "Pick list saved to your account")).catch(error => toast.error(error instanceof Error ? error.message : "Could not save pick list"))
  }
  const move = (to: string) => {
    if (!drag) return
    const next: Record<string, Team[]> = {}
    Object.entries(columns).forEach(([key, list]) => { next[key] = list.filter(team => team.number !== drag.number) })
    next[to].push(drag)
    setLists(current => ({ ...current, [listName]: next }))
    persistColumns(listName, next)
    setDrag(null)
  }
  const unlock = async (event: FormEvent) => {
    event.preventDefault()
    if (!onUnlockPrimary || !primaryPassword) return
    setUnlockingPrimary(true)
    try { await onUnlockPrimary(primaryPassword); setPrimaryPassword("") }
    finally { setUnlockingPrimary(false) }
  }
  const createList = async (event: FormEvent) => {
    event.preventDefault()
    const name = newListName.trim()
    if (!onPersist) { toast.info("Sign in to create and save a pick list."); return }
    if (!name) return
    if (name.toLocaleLowerCase() === "primary list") { toast.error("That name is reserved for the shared Primary list."); return }
    const existingName = Object.keys(lists).find(item => item.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (existingName) { toast.error(`A list named “${existingName}” already exists.`); return }
    const emptyColumns = baseColumns()
    setCreatingList(true)
    try {
      await onPersist(name, emptyColumns)
      setLists(current => ({ ...current, [name]: emptyColumns }))
      setListName(name)
      setNewListName("")
      setCreateListOpen(false)
      toast.success(`“${name}” created`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create pick list")
    } finally { setCreatingList(false) }
  }

  const primaryLocked = listName === "Primary list" && !primaryAccess?.unlocked
  const matchingLists = Object.keys(lists).filter(name => name.toLocaleLowerCase().includes(listSearch.trim().toLocaleLowerCase()))

  return <div className="page-stack">
    <SectionHeading eyebrow={`PICK LIST · ${eventCode}`} title="Build your alliance" description={`Drag ${eventCode} event teams into tiers to shape a pick list.`} />
    <div className="pick-toolbar"><div><strong>{listName === "Alex's list" ? "Personal pick list" : listName}</strong><span>{eventTeams.length} teams · {listName === "Primary list" ? "shared event list" : "changes save to your Convex account when signed in"}</span></div><Button variant="secondary" onClick={() => { setListSearch(""); setListBrowserOpen(true) }}><Search className="size-4" /> Browse pick lists</Button></div>
    {primaryLocked ? <Card><CardContent><div className="form-section"><strong>Primary list password</strong><p className="muted-copy">{onUnlockPrimary ? "Enter the event password to view and edit the shared list." : "Sign in to your Convex account to unlock the shared list."}</p>{onUnlockPrimary && <form className="primary-unlock-form" onSubmit={event => { void unlock(event).catch(error => toast.error(error instanceof Error ? error.message : "Could not unlock Primary list")) }}><Input type="password" autoComplete="current-password" aria-label="Primary list password" value={primaryPassword} onChange={event => setPrimaryPassword(event.target.value)} placeholder="Password" required /><Button type="submit" disabled={unlockingPrimary || !primaryPassword}>{unlockingPrimary ? "Unlocking…" : "Unlock Primary list"}</Button></form>}</div></CardContent></Card> : eventTeams.length ? <div className="kanban">{Object.entries(columns).map(([title, list]) => <div className="kanban-column" onDragOver={event => event.preventDefault()} onDrop={() => move(title)} key={title}><div className="column-heading"><span className={`tier-dot ${title.toLowerCase().replaceAll(" ", "-")}`} /><h3>{title}</h3><span className="column-count">{list.length}</span></div><div className="kanban-cards">{list.map(team => <div draggable onDragStart={() => setDrag(team)} className="pick-card" key={team.number}><GripVertical className="drag-handle size-4" /><div className="pick-avatar">{String(team.number).slice(-2)}</div><div className="pick-info"><strong>{team.number}</strong><span>{team.name}</span><div><span>Driver {team.driver || "—"}</span><span>Auto {team.auto || "—"}</span></div></div></div>)}{list.length === 0 && <div className="drop-hint">Drop teams here</div>}</div></div>)}</div> : <div className="empty-state"><ListChecks className="size-8" /><p>No team roster is available for {eventCode} yet. Import the Orange Alliance event to build a pick list.</p></div>}
    {listBrowserOpen && <Modal title="Browse pick lists" description={`Search ${eventCode} lists and choose one to open.`} onClose={() => setListBrowserOpen(false)}><div className="list-browser"><label className="search-wrap"><Search className="size-4 list-search-icon" /><Input autoFocus aria-label="Search pick lists" placeholder="Search pick lists..." value={listSearch} onChange={event => setListSearch(event.target.value)} /></label><div className="list-browser-results">{matchingLists.length ? matchingLists.map(name => <Button key={name} type="button" variant={name === listName ? "secondary" : "ghost"} className="list-browser-item" onClick={() => { setListName(name); setListBrowserOpen(false) }}><span><strong>{name}</strong><small>{name === "Primary list" ? "Shared event list · password protected" : `${lists[name]?.Uncategorized?.length ?? 0} teams still uncategorized`}</small></span><ChevronRight className="size-4" /></Button>) : <p className="empty-list-search">No pick lists match “{listSearch}”.</p>}</div><div className="list-browser-footer"><span>{matchingLists.length} of {Object.keys(lists).length} lists</span><Button onClick={() => { setListBrowserOpen(false); setCreateListOpen(true) }} disabled={!onPersist}><Plus className="size-4" /> New pick list</Button></div>{!onPersist && <p className="muted-copy">Sign in to create a personal pick list.</p>}</div></Modal>}
    {createListOpen && <Modal title="Create a pick list" description="Create a personal list for this event. Teams start in Uncategorized." onClose={() => { if (!creatingList) setCreateListOpen(false) }}><form className="create-list-form" onSubmit={event => { void createList(event) }}><label htmlFor="new-pick-list-name">List name</label><Input id="new-pick-list-name" autoFocus maxLength={60} value={newListName} onChange={event => setNewListName(event.target.value)} placeholder="e.g. Championship picks" required /><div className="list-browser-footer"><Button type="button" variant="secondary" onClick={() => setCreateListOpen(false)} disabled={creatingList}>Cancel</Button><Button type="submit" disabled={creatingList || !newListName.trim()}><Plus className="size-4" />{creatingList ? "Creating…" : "Create list"}</Button></div></form></Modal>}
  </div>
}
function PickListPage() { return convexClient ? <AuthenticatedPickList /> : <EventNotConnected /> }
function AuthenticatedPickList() {
  const { isAuthenticated } = useConvexAuth()
  const { eventCode, teams: eventTeams } = useEventData()
  const persist = useMutation(savePickList)
  const persistPrimary = useMutation(savePrimaryPickList)
  const unlockPrimary = useMutation(unlockPrimaryPickList)
  const primaryAccess = useQuery(getPrimaryPickList, { eventCode })
  const savedLists = useQuery(listMyPickLists, { eventCode })
  const teamsForEvent = eventTeams?.filter(team => team.competing !== false) ?? []
  const saveTiers = (columns: Record<string, Team[]>) => Object.fromEntries(Object.entries(columns).map(([tier, list]) => [tier, list.map(team => team.number)]))
  const onUnlock = async (password: string) => { await unlockPrimary({ eventCode, password }); toast.success("Primary list unlocked") }
  const board = (onPersist?: (listName: string, columns: Record<string, Team[]>) => Promise<unknown>, onPrimaryPersist?: (columns: Record<string, Team[]>) => Promise<unknown>) => <PickListBoard key={eventCode} eventCode={eventCode} eventTeams={teamsForEvent} savedLists={savedLists} primaryAccess={primaryAccess} onUnlockPrimary={isAuthenticated ? onUnlock : undefined} onPersist={onPersist} onPrimaryPersist={onPrimaryPersist} />
  if (!isAuthenticated) return board()
  return board(
    (listName, columns) => persist({ eventCode, listName, tiers: saveTiers(columns) }),
    columns => persistPrimary({ eventCode, tiers: saveTiers(columns) }),
  )
}
function NotFound() { return <div className="empty-state"><LayoutDashboard className="size-10" /><h2>Page not found</h2><Link to="/" className="back-link">Return home</Link></div> }
export const router = createBrowserRouter([{ path: "/", element: <AppLayout />, children: [{ index: true, element: <Overview /> }, { path: "teams", element: <TeamsPage /> }, { path: "teams/:teamNumber", element: <TeamDetail /> }, { path: "pit", element: <PitPage /> }, { path: "matches", element: <MatchPage /> }, { path: "matches/:matchNumber", element: <MatchPage /> }, { path: "assignments", element: <MatchAssignmentPage /> }, { path: "predictions", element: <PredictionsPage /> }, { path: "pick-list", element: <PickListPage /> }, { path: "profile", element: <ProfilePage /> }, { path: "login", element: <LoginPage /> }, { path: "signup", element: <LoginPage /> }, { path: "auth/convex-auth/login", element: <LoginPage /> }, { path: "auth/convex-auth/signup", element: <LoginPage /> }, { path: "*", element: <NotFound /> }] }])
