const convexUrl = process.env.VITE_CONVEX_URL || "http://127.0.0.1:3210"
let convexAlreadyRunning = false

try {
  const response = await fetch(new URL("/version", convexUrl), {
    signal: AbortSignal.timeout(2500),
  })
  convexAlreadyRunning = response.ok
} catch {
  // If Convex is unavailable, start it below with the frontend.
}

const command = convexAlreadyRunning
  ? ["bun", "run", "dev"]
  : ["bunx", "convex", "dev", "--start", "bun run dev"]

if (convexAlreadyRunning) {
  console.log(`Convex is responding at ${convexUrl}; starting Vite.`)
} else {
  console.log("Starting Convex and Vite together.")
}

const child = Bun.spawn(command, {
  cwd: process.cwd(),
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  windowsHide: true,
})

process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))

process.exit(await child.exited)
