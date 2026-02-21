'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useHeader } from '@/lib/header-context';
import { useProject } from '@/lib/project-context';

export default function ProjectsPage() {
  const { user } = useAuth();
  const { setParentPath } = useHeader();
  const { setProjects } = useProject();
  const [projects, setLocalProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setParentPath('/');
    return () => setParentPath(null);
  }, [setParentPath]);

  useEffect(() => {
    fetch('/api/projects', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        setLocalProjects(data);
        setProjects(data); // store in cache
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [setProjects]);

  if (loading) return <div className="p-8 text-center">Loading projects...</div>;
  if (error) return <div className="p-8 text-center text-red-400">Error: {error}</div>;

  const readyProjects = projects.filter(p => p.status === 'ready');

  return (
    <div className="main-app">
      <h1 className="text-3xl text-[var(--accent)] mb-6">Community Projects</h1>
      {readyProjects.length === 0 ? (
        <p className="text-[var(--muted)]">No projects published yet. Be the first!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {readyProjects.map((p) => (
            <div key={p.id} className="card">
              <h2 className="text-xl text-[var(--accent-2)]">{p.title}</h2>
              <p className="text-sm text-[var(--muted)] mb-2">
                by {p.author_name || 'Anonymous'} · {p.views} views
              </p>
              <p className="text-sm line-clamp-3">{p.description}</p>
              <Link
                href={`/projects/view?id=${p.id}`}
                className="inline-block mt-3 px-3 py-1.5 rounded-lg font-semibold text-sm border border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                Play
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
