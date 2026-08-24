# Vizow

Vizow is a contractor work-management app built as a Node/Express + PostgreSQL API, React/Vite frontend, and shared TypeScript package.

## Public demo routes

- `/demo` — 60-second tour and guided walkthrough
- `/app` — live private demo workspace; lands in Inbox with two open Requests
- `/app/today` — Today / transit view

All product routes live under `/app/*`. Public request and availability forms remain `/request` and `/availability`.

## Local build

```bash
npm run build
```

## Production start

```bash
npm start
```

`npm start` applies pending forward-only database migrations, then starts the Express server. When `frontend/dist` exists, Express serves the built SPA and `/api/*` from the same origin.
