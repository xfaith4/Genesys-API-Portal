import React, { useEffect, useMemo, useState } from 'react';
import { buildPathWithParams, buildSampleFromSchema } from '../utils/endpoint';
import { buildApiUrl, requestJson } from '../services/api';

const sanitizeParams = (params) => {
  const entries = Object.entries(params || {});
  return entries.reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const parseBody = (text) => {
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Request body must be valid JSON');
  }
};

export function QueryEditor({ endpoint, authToken, onSaveSuccess, selectedSavedQuery }) {
  const [pathParams, setPathParams] = useState({});
  const [queryParams, setQueryParams] = useState({});
  const [bodyText, setBodyText] = useState('');
  const [genesysToken, setGenesysToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [executing, setExecuting] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [description, setDescription] = useState('');
  const [lastResponse, setLastResponse] = useState(null);

  const operation = endpoint?.operation;
  const pathParameters = endpoint?.pathParameters || [];

  const parameterDefinitions = useMemo(() => {
    if (!operation) return { path: [], query: [] };

    const combined = [
      ...pathParameters,
      ...(operation.parameters || []),
    ].filter(Boolean);

    const pathParamsList = [];
    const queryParamsList = [];
    const seen = new Set();

    combined.forEach((param) => {
      if (seen.has(param.name)) {
        return;
      }
      seen.add(param.name);

      if (param.in === 'path') {
        pathParamsList.push(param);
      }
      if (param.in === 'query') {
        queryParamsList.push(param);
      }
    });

    return { path: pathParamsList, query: queryParamsList };
  }, [operation, pathParameters]);

  const requestBodySchema =
    operation?.requestBody?.content?.['application/json']?.schema;

  useEffect(() => {
    if (!endpoint) {
      return;
    }

    const matchesSavedQuery =
      selectedSavedQuery &&
      selectedSavedQuery.pathTemplate === endpoint.path &&
      selectedSavedQuery.method.toLowerCase() === endpoint.method.toLowerCase();

    const initialPathParams = {};
    parameterDefinitions.path.forEach((param) => {
      const savedValue = matchesSavedQuery ? selectedSavedQuery?.params?.[param.name] : undefined;
      initialPathParams[param.name] =
        savedValue ?? param.example ?? param.default ?? '';
    });

    const initialQueryParams = {};
    parameterDefinitions.query.forEach((param) => {
      const savedValue = matchesSavedQuery ? selectedSavedQuery?.query?.[param.name] : undefined;
      initialQueryParams[param.name] =
        savedValue ?? param.example ?? param.default ?? '';
    });

    setPathParams(initialPathParams);
    setQueryParams(initialQueryParams);

    if (matchesSavedQuery) {
      setBodyText(
        JSON.stringify(selectedSavedQuery.body ?? {}, null, 2)
      );
      setSaveName(selectedSavedQuery.name);
      setDescription(selectedSavedQuery.description || '');
    } else {
      const sampleBody = buildSampleFromSchema(requestBodySchema);
      const formatted =
        sampleBody && Object.keys(sampleBody).length
          ? JSON.stringify(sampleBody, null, 2)
          : '';
      setBodyText(formatted);
      setSaveName(`${endpoint.method.toUpperCase()} ${endpoint.path}`);
      setDescription('');
    }
  }, [
    endpoint,
    requestBodySchema,
    parameterDefinitions.path,
    parameterDefinitions.query,
    selectedSavedQuery,
  ]);

  const handleExecute = async () => {
    if (!endpoint) {
      return;
    }

    if (!authToken) {
      setErrorMessage('Please log in to execute requests.');
      return;
    }

    const missingPath = parameterDefinitions.path.filter(
      (param) => param.required && !pathParams[param.name]
    );
    if (missingPath.length) {
      setErrorMessage(`Missing path parameter: ${missingPath[0].name}`);
      return;
    }

    let parsedBody;
    try {
      parsedBody = parseBody(bodyText);
    } catch (err) {
      setErrorMessage(err.message);
      return;
    }

    const payload = {
      method: endpoint.method,
      path: buildPathWithParams(endpoint.path, pathParams),
      pathTemplate: endpoint.path,
      params: sanitizeParams(pathParams),
      query: sanitizeParams(queryParams),
      body: parsedBody,
      genesysToken: genesysToken.trim() || undefined,
    };

    setExecuting(true);
    setErrorMessage('');
    setStatusMessage('Executing request…');
    try {
      const response = await fetch(buildApiUrl('/api/proxy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      setLastResponse({
        status: response.status,
        statusText: data?.statusText ?? response.statusText,
        data: data?.data ?? data,
        headers: data?.headers,
      });

      if (!response.ok) {
        setErrorMessage(
          data?.error || data?.message || 'Request failed'
        );
        setStatusMessage('Request completed with errors.');
        return;
      }

      setStatusMessage('Request completed successfully.');
    } catch (err) {
      setErrorMessage(err.message);
      setStatusMessage('Request failed.');
    } finally {
      setExecuting(false);
    }
  };

  const handleSave = async () => {
    if (!endpoint) {
      return;
    }
    if (!authToken) {
      setErrorMessage('Log in before saving queries.');
      return;
    }

    let parsedBody;
    try {
      parsedBody = parseBody(bodyText);
    } catch (err) {
      setErrorMessage(err.message);
      return;
    }

    setSaveLoading(true);
    setErrorMessage('');
    setStatusMessage('Saving query…');
    try {
      await requestJson(
        '/api/savedQueries',
        {
          method: 'POST',
          body: {
            name: saveName || `${endpoint.method.toUpperCase()} ${endpoint.path}`,
            description,
            method: endpoint.method.toUpperCase(),
            path: buildPathWithParams(endpoint.path, pathParams),
            pathTemplate: endpoint.path,
            params: sanitizeParams(pathParams),
            query: sanitizeParams(queryParams),
            body: parsedBody ?? {},
          },
        },
        authToken
      );
      setStatusMessage('Saved query to backend.');
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message);
      setStatusMessage('Save failed.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleParamChange = (setter, name) => (event) => {
    setter((prev) => ({ ...prev, [name]: event.target.value }));
  };

  return (
    <div className="query-editor">
      <header className="query-header">
        <div>
          <h2>{endpoint ? endpoint.method.toUpperCase() : 'Select an endpoint'}</h2>
          <p className="path-display">{endpoint?.path}</p>
          {operation?.summary && <p className="muted-text">{operation.summary}</p>}
          {operation?.description && <p className="muted-text">{operation.description}</p>}
        </div>
        <div>
          {authToken ? (
            <span className="status-chip">Authenticated</span>
          ) : (
            <span className="status-chip warning">Login required</span>
          )}
        </div>
      </header>

      {endpoint ? (
        <>
          <section className="section">
            <h3 className="section-title">Parameters</h3>
            <div className="parameter-grid">
              {parameterDefinitions.path.map((param) => (
                <label key={param.name}>
                  <span>{`${param.name} (${param.required ? 'required' : 'optional'})`}</span>
                  <input
                    type="text"
                    value={pathParams[param.name] ?? ''}
                    onChange={handleParamChange(setPathParams, param.name)}
                    placeholder={param.description || ''}
                  />
                </label>
              ))}
              {parameterDefinitions.query.map((param) => (
                <label key={param.name}>
                  <span>{`${param.name} (query)`}</span>
                  <input
                    type="text"
                    value={queryParams[param.name] ?? ''}
                    onChange={handleParamChange(setQueryParams, param.name)}
                    placeholder={param.description || ''}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="section">
            <h3 className="section-title">Body</h3>
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              placeholder="Request body (JSON)"
            />
          </section>

          <section className="section">
            <label>
              <span>Genesys access token</span>
              <input
                type="text"
                value={genesysToken}
                onChange={(event) => setGenesysToken(event.target.value)}
                placeholder="Bearer token for Genesys API calls"
              />
            </label>
          </section>

          <section className="section">
            <div className="button-row">
              <button
                type="button"
                onClick={handleExecute}
                disabled={executing}
                className="primary"
              >
                {executing ? 'Executing…' : 'Execute request'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveLoading}
              >
                {saveLoading ? 'Saving…' : 'Save query'}
              </button>
            </div>
            <label>
              <span>Save name</span>
              <input
                type="text"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
              />
            </label>
            <label>
              <span>Description</span>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Summarize what the query does"
              />
            </label>
          </section>

          {statusMessage && <p className="muted-text">{statusMessage}</p>}
          {errorMessage && <p className="error-text">{errorMessage}</p>}

          {lastResponse && (
            <section className="section response-section">
              <h3 className="section-title">Response</h3>
              <p>
                Status {lastResponse.status} — {lastResponse.statusText}
              </p>
              <pre>{JSON.stringify(lastResponse.data, null, 2)}</pre>
            </section>
          )}
        </>
      ) : (
        <p className="muted-text">Choose an endpoint on the left to start.</p>
      )}
    </div>
  );
}
