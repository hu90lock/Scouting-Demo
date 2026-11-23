# Convex

## Configure local authentication

1. Copy `.env.example` to `.env.local` and set `VITE_CONVEX_URL` to your Convex deployment URL.
2. Run `bunx convex dev` and select or create the deployment.
3. Create a scout account on the login page with a username and password.

The app supports Convex Auth username/password accounts. The app shell is gated by the Convex Auth session, and authenticated pick-list data is saved under the signed-in identity. Without `VITE_CONVEX_URL`, the app displays a connection setup screen; authentication cannot run in preview mode.

Event data export is available to signed-in users from the event overview. It downloads an Excel workbook containing the active event's roster, schedule, pit and match reports, and the current user's pick lists and predictions. Match assignments and report saves are stored in Convex.

## Import teams from The Orange Alliance

Every event import runs through a Convex action, which requires the server-side `TOA_AUTH_KEY` and attaches it to each Orange Alliance API request. The key is never sent to the browser. Create an API key in your myTOA account, then set it on the active Convex deployment with `bunx convex env set TOA_AUTH_KEY <your-key>`. The initial active event is MXCOQ (Regional Coahuila — Torreón, FTC 2026–27). Enter `MXCOQ` in the app; Convex maps that FIRST event code to the TOA key `2627-MEX-COQ`. Other events can be entered using their event keys as shown in The Orange Alliance. Imported team records are saved in Convex under the public event code and streamed into the team directory.
