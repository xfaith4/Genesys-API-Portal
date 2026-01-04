# Genesys API Portal

This project wires up a full Genesys API dashboard with:

- a **backend** that caches the Genesys OpenAPI document, proxies authenticated queries, and tracks each user's saved requests,
- a **frontend** that renders the endpoint tree, lets you compose requests, and saves them per developer identity, and
- automated **tests** that cover the backend and frontend helpers so the stack can be validated end-to-end.

## Backend

### Highlights

- `GET /api/openapi.json` serves the cached OpenAPI spec (refreshes hourly).
- `POST /api/auth/register` and `/api/auth/login` manage users and return JWTs signed with `JWT_SECRET`.
- `POST /api/proxy` forwards Genesys API calls (method/path/query/body) while attaching the Genesys bearer token you supply.
- Authenticated `GET`/`POST /api/savedQueries` store queries per user with the path template, params, body, and optional description.

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

The Jest suite spins up an in-memory MongoDB instance and exercises authentication, saved-query CRUD, and the OpenAPI cache with a mocked Genesys response.

## Frontend

### Highlights

- Loads `/api/openapi.json` and renders every path/method in `EndpointTree.jsx`.
- `QueryEditor.jsx` auto-populates path/query params, renders a sample body schema, and proxies Genesys calls through `/api/proxy`.
- Saved queries post to `/api/savedQueries`, can be reloaded into the editor, and remain scoped to the authenticated user.
- Login/register persists a JWT in `localStorage` and gates execution/save actions.

### Setup

```bash
cd frontend
cp .env.example .env    # adjust VITE_API_BASE_URL if your backend runs elsewhere
npm install
npm run dev
```

The UI defaults to `http://localhost:4000` for the backend. Paste a valid Genesys OAuth bearer token into the editor before executing requests (the token is never stored server-side).

### Tests

```bash
npm run test
```

Runs `vitest run` against `src/utils/endpoint.test.js` so helpers like path interpolation and sample-body generation stay stable.

## Manual end-to-end flow

1. Start the backend and frontend in separate terminals.
2. Create or log in with a user through the UI, and note the JWT stored in the browser.
3. Pick an endpoint, fill required path params, add your Genesys token, and click **Execute request**.
4. Save the request, then reload it from the Saved Queries panel to ensure every field repopulates.
5. Restart either service and repeat to prove persistence across sessions.

## Notes

- The backend proxies Genesys requests so the browser only calls one origin.
- Saved queries live under `backend/src/models/SavedQuery.js` and always store the authenticated user's ID.
- The Genesys token you type into the editor is passed to `/api/proxy` for each execution but is not persisted anywhere.
- Run both `backend` and `frontend` tests before releasing; they cover key pieces of the end-to-end flow.
