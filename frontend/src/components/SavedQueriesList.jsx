import React from 'react';

export function SavedQueriesList({ queries = [], onSelect, loading, error, onRefresh }) {
  return (
    <div className="saved-queries">
      <div className="saved-queries-header">
        <h3>Saved queries</h3>
        <button type="button" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </div>
      {loading && <p className="muted-text">Loading saved queries…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !queries.length && !error && (
        <p className="muted-text">No saved queries yet.</p>
      )}
      <ul>
        {queries.map((query) => (
          <li key={query._id}>
            <button
              type="button"
              onClick={() => onSelect(query)}
              className="saved-query-row"
            >
              <span className="saved-query-name">{query.name}</span>
              <span className="saved-query-meta">
                {query.method.toUpperCase()} {query.path}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
