import { useCallback, useEffect, useMemo, useState } from 'react';
import { EndpointTree } from './components/EndpointTree';
import { PeakConcurrencyPanel } from './components/PeakConcurrencyPanel';
import { QueryEditor } from './components/QueryEditor';
import { SavedQueriesList } from './components/SavedQueriesList';
import { PRIMARY_API_BASE_URL, requestJson } from './services/api';
import { pickFirstEndpoint } from './utils/endpoint';

const STORAGE_TOKEN_KEY = 'genesys-portal-token';
const STORAGE_USER_KEY = 'genesys-portal-user';

const readFromStorage = (key) => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(key);
};

const writeToStorage = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (value == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
};

export default function App() {
  const [spec, setSpec] = useState(null);
  const [specLoading, setSpecLoading] = useState(true);
  const [specError, setSpecError] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState(() => readFromStorage(STORAGE_TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = readFromStorage(STORAGE_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [savedQueries, setSavedQueries] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState('');
  const [selectedSavedQuery, setSelectedSavedQuery] = useState(null);

  const persistAuth = useCallback(() => {
    writeToStorage(STORAGE_TOKEN_KEY, token);
    writeToStorage(
      STORAGE_USER_KEY,
      currentUser ? JSON.stringify(currentUser) : null
    );
  }, [token, currentUser]);

  useEffect(() => {
    persistAuth();
  }, [persistAuth]);

  useEffect(() => {
    let canceled = false;
    setSpecLoading(true);
    setSpecError('');

    requestJson('/api/openapi.json')
      .then((data) => {
        if (canceled) return;
        setSpec(data);
        const first = pickFirstEndpoint(data?.paths);
        if (first) {
          setSelectedEndpoint({
            ...first,
            pathParameters: data.paths[first.path]?.parameters || [],
          });
        }
      })
      .catch((err) => {
        if (canceled) return;
        setSpecError(err.message);
      })
      .finally(() => {
        if (canceled) return;
        setSpecLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, []);

  const handleSelectEndpoint = useCallback(
    ({ path, method, operation, pathItem }) => {
      setSelectedSavedQuery(null);
      setSelectedEndpoint({
        path,
        method,
        operation,
        pathParameters: pathItem?.parameters || [],
      });
    },
    []
  );

  const loadSavedQueries = useCallback(async () => {
    if (!token) {
      setSavedQueries([]);
      return;
    }

    setSavedLoading(true);
    setSavedError('');
    try {
      const queries = await requestJson('/api/savedQueries', { method: 'GET' }, token);
      setSavedQueries(queries);
    } catch (err) {
      setSavedError(err.message);
    } finally {
      setSavedLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  const handleLoadSavedQuery = useCallback(
    (query) => {
      setSelectedSavedQuery(query);
      if (!spec) {
        return;
      }
      const method = query.method.toLowerCase();
      const pathItem = spec.paths?.[query.pathTemplate];
      if (pathItem && pathItem[method]) {
        setSelectedEndpoint({
          path: query.pathTemplate,
          method,
          operation: pathItem[method],
          pathParameters: pathItem.parameters || [],
        });
      } else {
        setSelectedEndpoint(null);
      }
    },
    [spec]
  );

  useEffect(() => {
    if (spec && selectedSavedQuery) {
      handleLoadSavedQuery(selectedSavedQuery);
    }
  }, [spec, selectedSavedQuery, handleLoadSavedQuery]);

  // Handle SSO callback hash: token, name, email
  useEffect(() => {
    const { hash, pathname } = window.location;
    if (pathname === '/sso-callback' && hash.startsWith('#')) {
      const params = new URLSearchParams(hash.slice(1));
      const ssoToken = params.get('token');
      const name = params.get('name');
      const email = params.get('email');
      if (ssoToken && email) {
        setToken(ssoToken);
        setCurrentUser({ name: name || email, email });
        window.history.replaceState(null, '', '/');
      }
    }
  }, []);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');

    try {
      const payload = {
        email: authForm.email,
        password: authForm.password,
      };
      if (authMode === 'register') {
        payload.name = authForm.name;
      }
      const response = await requestJson(`/api/auth/${authMode}`, {
        method: 'POST',
        body: payload,
      });
      setToken(response.token);
      setCurrentUser(response.user);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setSavedQueries([]);
    setSelectedSavedQuery(null);
  };

  const authTitle = authMode === 'login' ? 'Sign in' : 'Create an account';
  const toggleAuthMode = () => {
    setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setAuthError('');
  };

  const specStatus = useMemo(() => {
    if (specLoading) return 'Loading spec…';
    if (specError) return specError;
    if (!spec?.paths) return 'Spec does not expose any paths';
    return null;
  }, [spec, specError, specLoading]);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Genesys API Portal</h1>
          <p className="subtitle">Explore the Genesys OpenAPI, execute queries, and save them per user.</p>
        </div>
        <div className="auth-panel">
          {token && currentUser ? (
            <>
              <p>
                Logged in as <strong>{currentUser.name}</strong>
              </p>
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <h2>{authTitle}</h2>
              {authMode === 'register' && (
                <input
                  placeholder="Name"
                  value={authForm.name}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                required
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              />
              {authError && <p className="error-text">{authError}</p>}
              <div className="auth-actions">
                <button type="submit">{authMode === 'login' ? 'Log in' : 'Register'}</button>
                <button type="button" className="ghost" onClick={toggleAuthMode}>
                  {authMode === 'login' ? 'Need an account?' : 'Already have an account?'}
                </button>
                <a className="ghost" href={`${PRIMARY_API_BASE_URL}/api/auth/sso/login`}>
                  Sign in with SSO
                </a>
              </div>
            </form>
          )}
        </div>
      </header>

      <main className="content-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Endpoints</h2>
            {specLoading && <span className="muted-text">Synced with backend</span>}
          </div>
          {specStatus ? (
            <p className="muted-text">{specStatus}</p>
          ) : (
            <EndpointTree
              spec={spec}
              onSelect={handleSelectEndpoint}
              selected={selectedEndpoint}
            />
          )}
        </section>

        <section className="panel">
          <QueryEditor
            endpoint={selectedEndpoint}
            authToken={token}
            selectedSavedQuery={selectedSavedQuery}
            onSaveSuccess={loadSavedQueries}
          />
        </section>

        <section className="panel">
          <SavedQueriesList
            queries={savedQueries}
            loading={savedLoading}
            error={savedError}
            onSelect={handleLoadSavedQuery}
            onRefresh={loadSavedQueries}
          />
        </section>
      </main>

      <section className="panel full-width">
        <PeakConcurrencyPanel portalToken={token} />
      </section>
    </div>
  );
}
