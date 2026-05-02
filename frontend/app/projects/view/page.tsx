'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useHeader } from '@/lib/header-context';
import { useProject } from '@/lib/project-context';

type Project = {
  id: number;
  status: string;
  deploy_method?: string;
  title: string;
  author_name?: string;
  views: number;
  description: string;
  url?: string;
};

function ProjectContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const statusParam = searchParams.get('status');
  const { setParentPath } = useHeader();
  const { getProject } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const showBuilding = statusParam === 'pending' || project?.status === 'pending' || project?.status === 'building';
  const isJava = project?.deploy_method === 'java';

  // Load CheerpJ for Java projects (must be before early returns)
  useEffect(() => {
    if (isJava && project?.status === 'ready') {
      const script = document.createElement('script');
      script.src = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
      script.onload = async () => {
        try {
          // @ts-expect-error CheerpJ is loaded globally
          await cheerpjInit({ version: 17 });
          const display = document.getElementById('cheerpj-display');
          if (display) {
            // @ts-expect-error CheerpJ types not installed
            cheerpjCreateDisplay(800, 600, display);
          }
          // @ts-expect-error CheerpJ types not installed
          await cheerpjRunJar(`/app/${project.id}.jar`);
        } catch (e) {
          console.error('CheerpJ init failed:', e);
          setError('Failed to load Java game');
        }
      };
      script.onerror = () => setError('Failed to load CheerpJ');
      document.body.appendChild(script);
      return () => { document.body.removeChild(script); };
    }
  }, [isJava, project?.status, project?.id]);

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
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/projects`, { credentials: 'include' })
      .then(res => res.json())
      .then((allProjects: Project[]) => {
        const found = allProjects.find(p => p.id === idNum);
        if (found) {
          setProject(found);
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
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/projects/${id}/view`, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
  }, [project, id]);

  if (!id) return <div className="p-8 text-center">No project ID provided</div>;
  if (loading) return <div className="p-8 text-center">Loading project...</div>;
  if (error) return <div className="p-8 text-center text-red-400">Error: {error}</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  return (
    <div className="main-app">
      <h1 className="text-2xl text-[var(--accent)] mb-2">{project.title}</h1>
      <p className="text-sm text-[var(--muted)] mb-4">
        by {project.author_name || 'Anonymous'} · {project.views} views
      </p>
      <p className="mb-4">{project.description}</p>

{project.status === 'ready' ? (
        isJava ? (
          <div className="border border-[var(--border)] rounded overflow-hidden aspect-video flex items-center justify-center">
            {error ? (
              <p className="text-red-400">{error}</p>
            ) : (
              <div id="cheerpj-display" className="w-[800px] h-[600px]" />
            )}
          </div>
        ) : (
          <div className="border border-[var(--border)] rounded overflow-hidden aspect-video">
            <iframe
              src={project.url}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              title={project.title}
              onError={() => setError('Game not loaded - may need rebuild')}
            />
          </div>
        )
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
