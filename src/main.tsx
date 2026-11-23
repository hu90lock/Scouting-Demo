import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "./components/ui/sonner"
import { convexClient } from "./lib/convex"
import { authApi } from "./lib/auth-api"
import { LoginPage, router } from "./router"
import { Button } from "./components/ui/button"
import "./index.css"
import "./theme-overrides.css"

function AppProviders() {
  const [demoAuthenticated, setDemoAuthenticated] = useState(false)
  const app = <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><RouterProvider router={router} /><Toaster /></ThemeProvider>
  if (!convexClient && import.meta.env.DEV) return <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{demoAuthenticated ? <><DemoSessionBanner /><RouterProvider router={router} /><Toaster /></> : <DemoLoginScreen onLogin={() => setDemoAuthenticated(true)} />}</ThemeProvider>
  if (!convexClient) return <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><ConvexSetupScreen /></ThemeProvider>
  return <ConvexAuthProvider client={convexClient} api={authApi}><AuthLoading><AuthLoadingScreen /></AuthLoading><Unauthenticated><LoginPage /></Unauthenticated><Authenticated>{app}</Authenticated></ConvexAuthProvider>
}

function DemoSessionBanner() { return <div role="status" style={{ position: "fixed", zIndex: 1000, inset: "0 0 auto", padding: "7px 12px", textAlign: "center", background: "#fff0d6", color: "#704600", fontSize: 12, fontWeight: 600 }}>Demo session · fake login · data is not saved to Convex</div> }
function DemoLoginScreen({ onLogin }: { onLogin: () => void }) { return <main className="auth-screen"><div className="auth-panel"><div className="brand-mark auth-mark">⚡</div><p className="eyebrow accent">SCOUTLINE · DEMO ACCESS</p><h1>Sign in to Scoutline</h1><p>Convex is not connected yet. Continue with a temporary demo session to explore the scouting interface. Demo changes are not saved.</p><Button className="w-full" onClick={onLogin}>Continue as demo scout</Button></div></main> }

function ConvexSetupScreen() { return <main className="auth-screen"><div className="auth-panel"><div className="brand-mark auth-mark">⚡</div><p className="eyebrow accent">SCOUTLINE AUTHENTICATION</p><h1>Connect your Convex account</h1><p>Convex Auth is ready, but this app is not connected to a Convex deployment yet. Add your deployment URL to enable real account sign in and saved scouting data.</p><p className="auth-setup-note">Set <code>VITE_CONVEX_URL</code> in <code>.env.local</code>, then run <code>bunx convex dev</code>. Your deployment URL is available in the Convex dashboard.</p></div></main> }
function AuthLoadingScreen() { const [takingTooLong, setTakingTooLong] = useState(false); useEffect(() => { const timeout = window.setTimeout(() => setTakingTooLong(true), 10000); return () => window.clearTimeout(timeout) }, []); return <main className="auth-screen"><div className="auth-panel"><div className="spinner" /><p>{takingTooLong ? "Convex is taking too long to respond." : "Checking your Scoutline session…"}</p>{takingTooLong && <><p className="auth-setup-note">The app cannot reach its Convex deployment. Start the backend with <code>bunx convex dev</code>, then retry.</p><Button className="w-full" onClick={() => window.location.reload()}>Retry connection</Button></>}</div></main> }

createRoot(document.getElementById("root")!).render(<StrictMode><AppProviders /></StrictMode>)
