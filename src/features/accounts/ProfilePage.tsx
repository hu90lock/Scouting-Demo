import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { ArrowRight, KeyRound, ListChecks, LogOut, Pencil, Target, Trash2, UserRoundCog, Users } from "lucide-react"
import { useAuthActions } from "@convex-dev/auth/react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { convexClient } from "../../lib/convex"
import { deleteScoutAccount, getAccountManagementAccess, getMyScoutProfile, listMyPickLists, listScoutAccounts, setMyScoutProfile, unlockAccountManagement, updateScoutAccount } from "../../lib/convex-api"
import { EventNotConnected, Modal, SectionHeading } from "../scouting/components"
import { useEventData } from "../scouting/use-event-data"

export function ProfilePage() {
  return convexClient ? <ConnectedProfilePage /> : <EventNotConnected />
}

function ConnectedProfilePage() {
  const { isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const { eventCode } = useEventData()
  const access = useQuery(getAccountManagementAccess, isAuthenticated ? { eventCode } : "skip")
  const profile = useQuery(getMyScoutProfile, isAuthenticated && access?.unlocked ? {} : "skip")
  const scouts = useQuery(listScoutAccounts, isAuthenticated && access?.unlocked ? { eventCode } : "skip")
  const pickLists = useQuery(listMyPickLists, isAuthenticated && access?.unlocked ? { eventCode } : "skip")
  const unlock = useMutation(unlockAccountManagement)
  const saveProfile = useMutation(setMyScoutProfile)
  const saveAccount = useMutation(updateScoutAccount)
  const removeAccount = useMutation(deleteScoutAccount)
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [editingScoutId, setEditingScoutId] = useState<string | null>(null)
  const [accountNickname, setAccountNickname] = useState("")
  const [pendingDelete, setPendingDelete] = useState<{ scoutId: string; scoutName: string; username: string } | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  useEffect(() => setDisplayName(profile?.displayName ?? ""), [profile?.displayName])

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault()
    setUnlocking(true)
    try {
      await unlock({ eventCode, password })
      setPassword("")
      toast.success("Account management unlocked")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unlock account management")
    } finally {
      setUnlocking(false)
    }
  }

  const submitName = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await saveProfile({ displayName })
      toast.success("Scout nickname updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update scout nickname")
    } finally {
      setSaving(false)
    }
  }

  const submitAccountEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingScoutId) return
    setSavingAccount(true)
    try {
      await saveAccount({ eventCode, scoutId: editingScoutId, displayName: accountNickname })
      setEditingScoutId(null)
      toast.success("Scout account updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update scout account")
    } finally {
      setSavingAccount(false)
    }
  }

  const confirmDeleteAccount = async () => {
    if (!pendingDelete) return
    setDeletingAccount(true)
    try {
      await removeAccount({ eventCode, scoutId: pendingDelete.scoutId })
      toast.success(`${pendingDelete.scoutName}'s account was deleted`)
      setPendingDelete(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete scout account")
    } finally {
      setDeletingAccount(false)
    }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow={`PROFILE · ${eventCode}`} title="Profile & accounts" description="Manage your scout identity, account access, and personal event pick lists." />
    {!isAuthenticated ? <Card><CardContent><div className="empty-state"><UserRoundCog className="size-8" /><p>Sign in to manage your profile and account settings.</p></div></CardContent></Card> : access?.unlocked ? <>
      <Card><CardHeader><CardTitle>Your scout profile</CardTitle></CardHeader><CardContent><form className="account-profile-form" onSubmit={event => { void submitName(event) }}><label className="modal-label">Scout nickname<Input autoComplete="nickname" minLength={2} maxLength={40} required value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Name used for match assignments" /></label><Button type="submit" disabled={saving || displayName.trim().length < 2}>{saving ? "Saving…" : "Save nickname"}</Button></form><p className="muted-copy">This nickname identifies your account in match assignments. Assignments are tied to your account even if the nickname changes.</p></CardContent></Card>
      <Card><CardHeader><div className="card-heading-row"><div><CardTitle>Manage scout accounts</CardTitle><p className="muted-copy">Edit scout nicknames or remove an account and its login access.</p></div><Badge variant="neutral">{scouts?.length ?? 0} accounts</Badge></div></CardHeader><CardContent>{scouts?.length ? <div className="account-list">{scouts.map(scout => <div className="account-list-row account-manage-row" key={scout.scoutId}><div className="account-list-avatar"><Users className="size-4" /></div>{editingScoutId === scout.scoutId ? <form className="account-edit-form" onSubmit={event => { void submitAccountEdit(event) }}><Input aria-label={`${scout.username || scout.scoutName} nickname`} autoFocus minLength={2} maxLength={40} required value={accountNickname} onChange={event => setAccountNickname(event.target.value)} /><Button type="submit" disabled={savingAccount || accountNickname.trim().length < 2}>{savingAccount ? "Saving…" : "Save"}</Button><Button type="button" variant="ghost" disabled={savingAccount} onClick={() => setEditingScoutId(null)}>Cancel</Button></form> : <><span className="account-manage-identity"><strong>{scout.scoutName || "Nickname not set"}</strong><small>{scout.username || "Registered scout"}</small></span>{scout.scoutId === profile?.ownerId && <Badge variant="success">You</Badge>}<div className="account-manage-actions"><Button type="button" variant="secondary" aria-label={`Edit ${scout.username || scout.scoutName} nickname`} onClick={() => { setEditingScoutId(scout.scoutId); setAccountNickname(scout.scoutName) }}><Pencil className="size-4" /><span>Edit</span></Button><Button type="button" variant="ghost" aria-label={`Delete ${scout.username || scout.scoutName}`} disabled={scout.scoutId === profile?.ownerId} title={scout.scoutId === profile?.ownerId ? "You cannot delete the account currently managing accounts" : "Delete account"} onClick={() => setPendingDelete(scout)}><Trash2 className="size-4" /><span>Delete</span></Button></div></>}</div>)}</div> : <p className="muted-copy">No registered scout accounts are available yet.</p>}</CardContent></Card>
      <Card><CardHeader><div className="card-heading-row"><div><CardTitle>Your pick lists</CardTitle><p className="muted-copy">Personal lists saved to your Convex account for {eventCode}.</p></div><Badge variant="neutral">{pickLists?.length ?? 0} lists</Badge></div></CardHeader><CardContent>{pickLists?.length ? <div className="account-list">{pickLists.map(list => <div className="account-list-row" key={list.listName}><div className="account-list-avatar"><ListChecks className="size-4" /></div><strong>{list.listName}</strong><span className="account-list-meta">{Object.values(list.tiers).reduce((total, teams) => total + teams.length, 0)} teams</span></div>)}</div> : <p className="muted-copy">You have no personal pick lists for this event yet.</p>}<Link to="/pick-list" className="btn btn-secondary account-pick-link">Open pick lists <ArrowRight className="size-4" /></Link></CardContent></Card>
      <div className="account-link-grid"><Link to="/predictions" className="account-link-card"><Target className="size-5" /><span><strong>Prediction profile</strong><small>View your event prediction record</small></span><ArrowRight className="size-4" /></Link><button type="button" className="account-link-card" onClick={() => void signOut().then(() => toast.success("Signed out")).catch(() => toast.error("Could not sign out"))}><LogOut className="size-5" /><span><strong>Sign out</strong><small>End this account session</small></span><ArrowRight className="size-4" /></button></div>
    </> : access === undefined ? <Card><CardContent><div className="empty-state">Loading account access…</div></CardContent></Card> : <Card><CardHeader><CardTitle>Unlock account management</CardTitle></CardHeader><CardContent><p className="muted-copy">Enter the shared Primary Pick List password to manage account settings. This unlock is separate from the Primary Pick List.</p><form className="account-unlock-form" onSubmit={event => { void submitPassword(event) }}><label className="modal-label"><span className="account-password-label"><KeyRound className="size-4" /> Access password</span><Input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="Primary Pick List password" /></label><Button type="submit" disabled={unlocking || !password}>{unlocking ? "Unlocking…" : "Unlock account management"}</Button></form></CardContent></Card>}
    {pendingDelete && <Modal title="Delete scout account?" description={`This permanently disables ${pendingDelete.username || pendingDelete.scoutName}'s login, removes their nickname and assignments, and deletes their personal pick lists and predictions. Existing scouting reports are kept with scout identity anonymized.`} onClose={() => { if (!deletingAccount) setPendingDelete(null) }}><div className="account-delete-actions"><Button type="button" variant="secondary" disabled={deletingAccount} onClick={() => setPendingDelete(null)}>Cancel</Button><Button type="button" onClick={() => void confirmDeleteAccount()} disabled={deletingAccount}>{deletingAccount ? "Deleting…" : "Delete account"}</Button></div></Modal>}
  </div>
}
