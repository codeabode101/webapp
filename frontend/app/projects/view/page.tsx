'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useHeader } from '@/lib/header-context';
import { useAuth } from '@/lib/auth';
import { useProject } from '@/lib/project-context';

function ProjectContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const statusParam = searchParams.get('status');
  const { user } = useAuth();
  const { setParentPath } = useHeader();
  const { getProject } = useProject();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setParentPath('/projects');
    return () => setParentPath(null);
  }, [setParentPath]);

  useEffect(() => {
    if (!id) return;

    const idNum = Number(id);
    const cached = getProject(idNum);
    if (cached) {
      setProject(cached);
      setLoading(false);
      return;
    }

    // Fallback: fetch all projects (or a single project endpoint)
    fetch('/api/projects', { credentials: 'same-origin' })
      .then(res => res.json())
      .then((allProjects) => {
        const found = allProjects.find((p: any) => p.id === idNum);
        if (found) {
          setProject(found);
          // Optionally add to cache via a separate `addProject` function
          // (We'll need to expose addProject from context for this)
        } else {
          setError('Project not found');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, getProject]);

  // Increment view count if project is ready (optional)
  useEffect(() => {
    if (project && project.status === 'ready') {
      fetch(`/api/projects/${id}/view`, { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    }
  }, [project, id]);

  if (!id) return <div className="p-8 text-center">No project ID provided</div>;
  if (loading) return <div className="p-8 text-center">Loading project...</div>;
  if (error) return <div className="p-8 text-center text-red-400">Error: {error}</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  const showBuilding = statusParam === 'pending' || project.status === 'pending' || project.status === 'building';

  return (
    <div className="main-app">
      <h1 className="text-2xl text-[var(--accent)] mb-2">{project.title}</h1>
      <p className="text-sm text-[var(--muted)] mb-4">
        by {project.author_name || 'Anonymous'} · {project.views} views
      </p>
      <p className="mb-4">{project.description}</p>

      {project.status === 'ready' ? (
        <div className="border border-[var(--border)] rounded overflow-hidden aspect-video">
          <iframe
            src={project.url}
            className="w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-forms"
            title={project.title}
          />
        </div>
      ) : showBuilding ? (
        <div className="p-8 text-center border border-[var(--border)] rounded">
          <p className="text-lg">⏳ Your project is being built...</p>
          <p className="text-sm text-[var(--muted)]">This may take a minute or two. Refresh the page to check status.</p>
        </div>
      ) : (
        <div className="p-8 text-center border border-[var(--border)] rounded">
          <p className="text-lg text-[var(--danger)]">Build failed.</p>
          <p className="text-sm text-[var(--muted)]">Please try again or contact support.</p>
        </div>
      )}

      <div className="mt-8 bg-[var(--accent)] rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white text-center sm:text-left">
          Want to code your own project?
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="https://codeabode.co/"
            className="px-5 py-2.5 rounded-lg font-bold text-sm border-2 border-white text-white hover:bg-white/10 transition-colors text-center"
          >
            Check us Out
          </Link>
          <Link
            href="https://codeabode.co/signup.html"
            className="px-5 py-2.5 rounded-lg font-bold text-sm bg-white text-[var(--accent)] hover:bg-gray-100 transition-colors text-center"
          >
            Contact Us for Classes
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProjectViewPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ProjectContent />
    </Suspense>
  );
}
