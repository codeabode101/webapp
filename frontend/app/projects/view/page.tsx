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
  author_name?: string | null;
  views: number;
  description: string;
  url?: string;
  jar_url?: string;
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
  const [cheerpjReady, setCheerpjReady] = useState(false);

  const showBuilding = statusParam === 'pending' || project?.status === 'pending' || project?.status === 'building';
  const isJava = project?.deploy_method === 'java';

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

    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/projects/${id}`, { credentials: 'include' })
      .then(res => res.json())
      .then(setProject)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, getProject]);

  useEffect(() => {
    if (project && project.status === 'ready') {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/projects/${id}/view`, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
  }, [project, id]);

  // Load CheerpJ runtime once
  useEffect(() => {
    if (!isJava || project?.status !== 'ready') return;

    const script = document.createElement('script');
    script.src = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
    script.onload = async () => {
      try {
        // @ts-expect-error CheerpJ is loaded globally
        await cheerpjInit({ version: 17 });
        const display = document.getElementById('cheerpj-display');
        if (display) {
          const w = display.clientWidth || 800;
          const h = display.clientHeight || 600;
          // @ts-expect-error CheerpJ types not installed
          cheerpjCreateDisplay(w, h, display);
        }
        setCheerpjReady(true);
      } catch (e) {
        console.error('CheerpJ init failed:', e);
        setError('Failed to initialize CheerpJ: ' + (e instanceof Error ? e.message : String(e)));
      }
    };
    script.onerror = () => setError('Failed to load CheerpJ script');
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [isJava, project?.status]);

  // Load and run the JAR using /str/ after CheerpJ is ready
  useEffect(() => {
    if (!cheerpjReady || !project) return;

    (async () => {
      try {
        const jarUrl = project.jar_url || `https://api.codeabode.co/api/projects/${project.id}/jar`;
        console.log('Fetching jar from:', jarUrl);

        const response = await fetch(jarUrl, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch JAR (' + response.status + ') from ' + jarUrl);

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // @ts-expect-error CheerpJ types not installed
        cheerpOSAddStringFile('/str/app.jar', uint8Array);

        // @ts-expect-error CheerpJ types not installed
        await cheerpjRunJar('/str/app.jar');
      } catch (e) {
        console.error('CheerpJ jar load failed:', e);
        setError('Failed to load Java application: ' + (e instanceof Error ? e.message : String(e)));
      }
    })();
  }, [cheerpjReady, project]);

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
          <div className="border border-[var(--border)] rounded overflow-hidden flex items-start justify-center max-w-full">
            {error ? (
              <p className="text-red-400">{error}</p>
            ) : (
              <div id="cheerpj-display" className="w-full" />
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
