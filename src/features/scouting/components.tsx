import type { ReactNode } from "react"
import { Activity, X } from "lucide-react"

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow accent">{eyebrow}</p><h2>{title}</h2>{description && <p className="section-description">{description}</p>}</div>{action}</div>
}

export function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal-card" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="modal-header"><div><h3>{title}</h3>{description && <p>{description}</p>}</div><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X className="size-4" /></button></div>{children}</div></div>
}

export function EventNotConnected() {
  return <div className="empty-state"><Activity className="size-10" /><h2>Live regional data is not connected</h2><p>Connect the app to Convex and configure TOA_AUTH_KEY to load event teams, match schedules, and alliance participants from The Orange Alliance.</p></div>
}

export function Counter({ label, value, onChange, boolean }: { label: string; value: number; onChange: (value: number) => void; boolean?: boolean }) {
  return <div className="counter"><span>{label}</span>{boolean ? <button type="button" role="switch" aria-checked={value > 0} aria-label={label} className={`toggle ${value ? "on" : ""}`} onClick={() => onChange(value ? 0 : 1)}><span /></button> : <div className="stepper"><button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>−</button><strong>{value}</strong><button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)}>+</button></div>}</div>
}
