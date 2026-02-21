'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useHeader } from '@/lib/header-context';
import { useAuth } from '@/lib/auth';

function PublishContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('c');
  const workType = searchParams.get('t'); // 'cw' or 'hw'
  const studentId = searchParams.get('s');
  const { setParentPath } = useHeader();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Set back button to return to the work page
  useEffect(() => {
    if (classId && workType) {
      setParentPath(`/work?c=${classId}&t=${workType}&s=${studentId}`);
    } else {
      setParentPath('/');
    }
    return () => setParentPath(null);
  }, [classId, workType, studentId, setParentPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Title and description are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          class_id: Number(classId),
          work_type: workType === 'cw' ? 'classwork' : 'homework',
          title: title.trim(),
          description: description.trim(),
          deploy_method: 'pygbag',
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to publish project');
      }
      const data = await res.json();
      router.push(`/projects/view?id=${data.id}?status=pending`);
    } catch (err) {
      alert('Error: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!classId || !workType) {
    return <div className="p-8">Invalid parameters</div>;
  }

  if (!user) {
    return <div className="p-8">Please log in.</div>;
  }

  return (
    <div className="main-app">
      <div className="card max-w-2xl mx-auto my-8">
        <h2 className="text-xl text-[var(--accent)] mb-4">Publish Your Project</h2>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <label htmlFor="title" className="text-sm text-[var(--muted)]">Project Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[#101939] text-[var(--text)]"
          />

          <label htmlFor="description" className="text-sm text-[var(--muted)]">Short Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[#101939] text-[var(--text)] resize-none"
          />

          <div className="flex gap-4 mt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-3 py-1.5 rounded-lg font-semibold text-sm border border-[var(--danger)] text-[var(--danger)] bg-transparent hover:bg-[var(--danger)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg font-semibold text-sm border border-[var(--accent-2)] text-[var(--accent-2)] bg-transparent hover:bg-[var(--accent-2)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Publishing...' : 'Publish Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PublishPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <PublishContent />
    </Suspense>
  );
}
