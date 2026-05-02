'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHeader } from '@/lib/header-context';

export default function NewProjectPage() {
  const { setParentPath } = useHeader();
  const router = useRouter();
  const [step, setStep] = useState<'language' | 'pygame' | 'java'>('language');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pygame state
  const [pygameTitle, setPygameTitle] = useState('');
  const [pygameDesc, setPygameDesc] = useState('');
  const [pygameCode, setPygameCode] = useState('');

  // Java state
  const [javaTitle, setJavaTitle] = useState('');
  const [javaDesc, setJavaDesc] = useState('');
  const [javaJar, setJavaJar] = useState<File | null>(null);

  useEffect(() => {
    setParentPath('/projects');
    return () => setParentPath(null);
  }, [setParentPath]);

  const handlePygameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pygameTitle || !pygameCode) {
      setError('Title and code are required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/submit_project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: pygameTitle,
          description: pygameDesc,
          work_type: 'standalone',
          work: pygameCode,
          deploy_method: 'pygbag'
        })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/projects/view?id=${data.id}&status=${data.status}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleJavaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!javaTitle || !javaJar) {
      setError('Title and jar file are required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', javaTitle);
      formData.append('description', javaDesc);
      formData.append('jar', javaJar);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/submit_project`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/projects/view?id=${data.id}&status=${data.status}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-app max-w-2xl mx-auto">
      <h1 className="text-3xl text-[var(--accent)] mb-6">Create New Project</h1>

      {step === 'language' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setStep('pygame')}
            className="card p-6 text-left hover:border-[var(--accent)] transition-colors"
          >
            <h2 className="text-xl text-[var(--accent-2)] mb-2">Pygame</h2>
            <p className="text-sm text-[var(--muted)]">Paste your Pygame code to build a web-ready project</p>
          </button>
          <button
            onClick={() => setStep('java')}
            className="card p-6 text-left hover:border-[var(--accent)] transition-colors"
          >
            <h2 className="text-xl text-[var(--accent-2)] mb-2">Java</h2>
            <p className="text-sm text-[var(--muted)]">Upload a JDK 17 compatible .jar file</p>
          </button>
        </div>
      )}

      {step === 'pygame' && (
        <form onSubmit={handlePygameSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={pygameTitle}
              onChange={(e) => setPygameTitle(e.target.value)}
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={pygameDesc}
              onChange={(e) => setPygameDesc(e.target.value)}
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] h-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pygame Code</label>
            <textarea
              value={pygameCode}
              onChange={(e) => setPygameCode(e.target.value)}
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] h-64 font-mono text-sm"
              placeholder="Paste your Pygame code here..."
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('language')}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--border)] transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {step === 'java' && (
        <form onSubmit={handleJavaSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={javaTitle}
              onChange={(e) => setJavaTitle(e.target.value)}
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={javaDesc}
              onChange={(e) => setJavaDesc(e.target.value)}
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] h-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">JDK 17 .jar File</label>
            <input
              type="file"
              accept=".jar"
              onChange={(e) => setJavaJar(e.target.files?.[0] || null)}
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
              required
            />
            <p className="text-xs text-[var(--muted)] mt-1">Must be compiled with JDK 17 for CheerpJ compatibility</p>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('language')}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--border)] transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Uploading...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
