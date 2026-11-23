# Scouting Demo

Framework-only React application baseline using Bun, Vite, React Router 7 SPA routing, strict TypeScript, Tailwind CSS v4, shadcn/ui with Base UI, Convex, Zustand, next-themes, Lucide, and Sonner.

## Run

```bash
bun install
bun run start
```

`bun run start` starts the Convex development backend and the Vite app together. If Convex is already responding, it starts just Vite to avoid launching a duplicate local backend. Leave this command running while using the app. To run only the frontend, use `bun run dev`.

Set `VITE_CONVEX_URL` in `.env.local` to the deployment used by Convex. `bun run start` checks whether that Convex endpoint is already responding; if it is unavailable, it starts `bunx convex dev` and launches Vite when the backend is ready. Login uses Convex Auth username/password, and authenticated pick-list changes are saved under the current user identity.

The shared Primary pick list is protected by `PRIMARY_PICK_LIST_PASSWORD`. Set it on the same Convex deployment used by the app with `bunx convex env set PRIMARY_PICK_LIST_PASSWORD '<your password>'`. Signed-in users must unlock it once per event and account; changes then save to the shared Convex list.
