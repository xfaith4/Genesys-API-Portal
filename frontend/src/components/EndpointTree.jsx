import React from 'react';
import { methodPriority } from '../utils/endpoint';

const normalizeOperations = (methods) => {
  return Object.entries(methods || {})
    .map(([method, operation]) => ({
      method: method.toLowerCase(),
      operation,
    }))
    .sort((a, b) => {
      const aIndex = methodPriority.indexOf(a.method);
      const bIndex = methodPriority.indexOf(b.method);
      if (aIndex === bIndex) {
        return a.method.localeCompare(b.method);
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
};

export function EndpointTree({ spec, onSelect, selected }) {
  if (!spec || !spec.paths) {
    return <p className="empty-state">Waiting for the OpenAPI document …</p>;
  }

  const entries = Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="endpoint-tree">
      {entries.map(([path, methods]) => (
        <article key={path} className="endpoint-cluster">
          <div className="path-label">{path}</div>
          <div className="method-wrap">
            {normalizeOperations(methods).map(({ method, operation }) => {
              const isSelected = selected?.path === path && selected.method === method;
              return (
                <button
                  key={`${path}-${method}`}
                  className={`method-button ${isSelected ? 'selected' : ''}`}
                  type="button"
                  onClick={() =>
                    onSelect({
                      path,
                      method,
                      operation,
                      pathItem: spec.paths[path],
                    })
                  }
                >
                  <span className="method-name">{method.toUpperCase()}</span>
                  <span className="method-summary">{operation.summary || operation.description || 'No summary'}</span>
                </button>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
