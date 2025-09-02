# Custom-Genesys-API-Portal
/genesys-explorer
- backend/
- - src/
- - - routes/
- - - - savedQueries.js
- - - models/
- - - - SavedQuery.js
- - - index.js
- - package.json
- frontend/
- - src/
- - components/
 - - EndpointTree.jsx
- - - QueryEditor.jsx
- - - SavedQueriesList.jsx
 - - App.jsx
 - - index.css
 - - package.json

1. Load the Genesys OpenAPI JSON in your front end and build an EndpointTree component that drills into each path/method.

2. Wire up your QueryEditor so that it:
 - Populates with path-params, query-params, and body schema.
 - Calls fetch(genesysApiUrl, { method, headers: { Authorization… }, body }).

3. Hook “Save” to POST your current method / path / params / body to your back-end.

4. Persist users (add real auth) so each dev sees their own saved queries.
