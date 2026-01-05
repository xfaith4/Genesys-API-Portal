# Genesys API Portal

This project wires up a Genesys Cloud operational awareness dashboard:

- a **backend** that caches the OpenAPI doc, proxies authenticated Genesys calls, persists per-user saved queries, and runs the “peak concurrent voice calls” insight pack on demand,
- a **frontend** that renders the endpoint explorer, request editor, saved-query list, token/history UX, plus the peak-concurrency panel described in the roadmap, and
- automated **tests** that cover the backend routes and frontend helper utilities so the stack can be validated end-to-end.

## Backend

### Highlights

- `GET /api/openapi.json` serves the cached OpenAPI spec (refreshes hourly).
- `POST /api/auth/register` and `/api/auth/login` manage users and return JWTs signed with `JWT_SECRET`.
- `POST /api/proxy` forwards Genesys API calls (method/path/query/body) while attaching the Genesys bearer token you supply.
- Authenticated `GET`/`POST /api/savedQueries` store queries per user with the path template, params, body, and optional description.
- `POST /api/insights/peakConcurrency` runs the “peak concurrent voice calls” analytics job, polls the result, and returns the max concurrency plus the minute-by-minute peak minutes.

### Setup

```bash
cd backend
cp .env.example .env
# update MONGODB_URI, JWT_SECRET, and optionally GENESYS_* variables
npm install
npm run dev
```

MongoDB must be reachable through `MONGODB_URI`; the Swagger cache lives under `backend/cache/swagger.json`. The Genesys base URL defaults to `https://api.cac1.pure.cloud/api/v2`.

### Tests

```bash
npm test
```

Jest spins up an in-memory MongoDB instance and mocks Genesys responses so auth, saved queries, and the new insight route stay covered.

## Frontend

### Highlights

- Loads `/api/openapi.json` and renders every path/method in `EndpointTree.jsx`.
- `QueryEditor.jsx` auto-populates path/query params, renders a sample body schema, and proxies Genesys calls through `/api/proxy`.
- Saved queries post to `/api/savedQueries`, can be reloaded into the editor, and remain scoped to the authenticated user.
- Login/register keeps a JWT in `localStorage` and gates execution/save actions.
- **Peak concurrency panel** lets you supply a Genesys OAuth token, pick any UTC window, compute the peak concurrent voice sessions, download the JSON evidence, and replay recent runs.

### Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The UI defaults to `http://localhost:4000` for the backend. Paste a measurable Genesys OAuth bearer token into the editor/panel before executing requests—the token is never persisted server-side.

### Tests

```bash
npm run test
```

Runs `vitest run` against `src/utils/endpoint.test.js`.

## Manual end-to-end flow

1. Start the backend and frontend in separate terminals.
2. Create or log in with a user through the UI, and note the JWT stored in the browser.
3. Pick an endpoint, fill required path params, add your Genesys token, and click **Execute request**.
4. Save the request, then reload it from the Saved Queries panel to ensure every field repopulates.
5. Visit the Peak Concurrent Voice Calls panel, enter a Genesys OAuth token, select your UTC window, and compute the metric to inspect the peak minutes and download the evidence JSON.
6. Restart either service and repeat to prove persistence across sessions.

## Notes

- The backend proxies Genesys requests so the browser only calls one origin.
- Saved queries live under `backend/src/models/SavedQuery.js` and always store the authenticated user's ID.
- The Genesys token you enter is forwarded to `/api/proxy` and `/api/insights/peakConcurrency` for each execution but is not stored on the server.
- Run both `backend` and `frontend` tests before releasing; they cover the key pieces of the end-to-end flow.
