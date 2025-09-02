import React, { useEffect, useState } from 'react';

export function SavedQueriesList({ onSelect }) {
  const [list, setList] = useState([]);

  useEffect(() => {
    fetch('http://localhost:4000/api/savedQueries')
      .then(r => r.json())
      .then(setList);
  }, []);

  return (
    <div>
      <h3>Saved Queries</h3>
      <ul>
        {list.map(q => (
          <li key={q._id}>
            <button onClick={() => onSelect(q)}>{q.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
