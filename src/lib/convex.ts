import { ConvexReactClient } from "convex/react"

const url = import.meta.env.VITE_CONVEX_URL
export const convexClient = url ? new ConvexReactClient(url) : null
