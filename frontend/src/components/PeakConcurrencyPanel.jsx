import { useCallback, useMemo, useState } from 'react';
import { requestJson } from '../services/api';

const formatForInput = (date) => date.toISOString().slice(0, 16);

export function PeakConcurrencyPanel({ portalToken }) {
  const now = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(() => formatForInput(new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(() => formatForInput(now));
  const [genesysToken, setGenesysToken] = useState('');
  const [excludeWrapup, setExcludeWrapup] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const startIso = useMemo(() => (startDate ? new Date(startDate).toISOString() : null), [startDate]);
  const endIso = useMemo(() => (endDate ? new Date(endDate).toISOString() : null), [endDate]);

  const handleCompute = useCallback(async () => {
    if (!portalToken) {
      setError('Log in before running insights.');
      return;
    }
    if (!genesysToken.trim()) {
      setError('Provide a Genesys bearer token.');
      return;
    }
    if (!startIso || !endIso || new Date(startIso) >= new Date(endIso)) {
      setError('Select a valid time range.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Computing peak concurrency…');
    try {
      const payload = {
        startDate: startIso,
        endDate: endIso,
        excludeWrapup,
        genesysToken: genesysToken.trim(),
      };

      const response = await requestJson('/api/insights/peakConcurrency', { method: 'POST', body: payload }, portalToken);
      setResult(response);
      setHistory((prev) => [
        {
          timestamp: new Date().toISOString(),
          startDate: startIso,
          endDate: endIso,
          peak: response.peakConcurrent,
        },
        ...prev,
      ].slice(0, 10));
      setStatus('Peak concurrency computed.');
    } catch (err) {
      setError(err.message);
      setStatus('Failed to compute peak concurrency.');
    } finally {
      setLoading(false);
    }
  }, [portalToken, genesysToken, excludeWrapup, startIso, endIso]);

  const handleReplay = useCallback((entry) => {
    setStartDate(entry.startDate.slice(0, 16));
    setEndDate(entry.endDate.slice(0, 16));
  }, []);

  const downloadResult = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'peak-concurrency.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="peak-panel">
      <header className="panel-header">
        <div>
          <h2>Peak Concurrent Voice Calls</h2>
          <p className="muted-text">Compute the max concurrency over any window via Genesys Analytics.</p>
        </div>
      </header>

      <div className="section">
        <label>
          <span>Window start (UTC)</span>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label>
          <span>Window end (UTC)</span>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <label>
          <span>Exclude wrap-up segments</span>
          <input
            type="checkbox"
            checked={excludeWrapup}
            onChange={(event) => setExcludeWrapup(event.target.checked)}
          />
        </label>
      </div>

      <div className="section">
        <label>
          <span>Genesys bearer token</span>
          <input
            type="password"
            value={genesysToken}
            onChange={(event) => setGenesysToken(event.target.value)}
            placeholder="Paste a valid OAuth token"
          />
        </label>
      </div>

      <div className="button-row">
        <button type="button" className="primary" onClick={handleCompute} disabled={loading}>
          {loading ? 'Computing…' : 'Compute peak concurrency'}
        </button>
        <button type="button" onClick={downloadResult} disabled={!result}>
          Download result
        </button>
      </div>

      {status && <p className="muted-text">{status}</p>}
      {error && <p className="error-text">{error}</p>}

      {result && (
        <section className="response-section">
          <h3 className="section-title">Summary</h3>
          <div className="kv">
            <div>Peak concurrent calls</div>
            <div>{result.peakConcurrent}</div>
            <div>First peak minute (UTC)</div>
            <div>{result.firstPeakMinuteUtc || 'n/a'}</div>
            <div>Total conversations inspected</div>
            <div>{result.totalConversations}</div>
          </div>
          <h4>Peak minutes</h4>
          <ul className="history-list">
            {result.peakMinutesUtc.map((minute) => (
              <li key={minute}>{minute}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h3 className="section-title">History</h3>
        {!history.length && <p className="muted-text">No runs yet.</p>}
        <ul className="history-list">
          {history.map((entry) => (
            <li key={entry.timestamp}>
              <div>
                <strong>{entry.peak}</strong> | {entry.startDate} → {entry.endDate}
              </div>
              <button type="button" onClick={() => handleReplay(entry)}>
                Replay
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
