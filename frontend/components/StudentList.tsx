'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

interface StudentInfo {
  id: number;
  name: string;
}

export default function StudentList() {
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('');
  const { user, refresh } = useAuth();

  const loadStudents = async () => {
    setStatus('Loading students…');
    try {
      const res = await fetch('/api/list_students', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        if (res.status === 401) {
          // token expired
          refresh(); // will clear user
          return;
        }
        const text = await res.text();
        setStatus(`Failed: ${text}`);
        return;
      }
      const data = await res.json();
      setStudents(data);
      setStatus('Loaded.');
    } catch (err) {
      setStatus('Network error');
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) loadStudents();
  }, [user]);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <section className="students">
      <div className="row">
        <button onClick={loadStudents}>Load / Refresh Students</button>
        <input
          type="search"
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <ul>
        {filtered.length === 0 ? (
          <li className="empty">No students found.</li>
        ) : (
          filtered.map((s) => (
            <li key={s.id}>
              <span><strong>{s.name}</strong></span>
              <span>
                <Link href={`/student?id=${s.id}`} className="view-btn">
                  View
                </Link>
              </span>
            </li>
          ))
        )}
      </ul>

      <div className={`status ${status.includes('Loaded') ? 'ok' : 'warn'}`}>
        {status || 'You may need to login first.'}
      </div>
    </section>
  );
}
