'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useHeader } from '@/lib/header-context';
import { useAuth } from '@/lib/auth';

function AskContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('c');
  const workType = searchParams.get('t'); // 'classwork' or 'homework'
  const studentId = searchParams.get('s');
  const { setParentPath } = useHeader();
  const { user } = useAuth();

  const [error, setError] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Set back button to return to the work page
  useEffect(() => {
    if (classId && workType) {
      setParentPath(`/work?c=${classId}&t=${workType}&s=${studentId}`);
    } else {
      setParentPath('/');
    }
    return () => setParentPath(null);
  }, [classId, workType, setParentPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      alert('Question is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          class_id: Number(classId),
          work_type: workType,
          error: error.trim(),
          interpretation: interpretation.trim(),
          question: question.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Question submitted successfully');
      router.push('/forum');
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
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <h2>Ask a Question</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="error">Error Message (optional)</label>
          <textarea
            id="error"
            value={error}
            onChange={(e) => setError(e.target.value)}
            placeholder="Paste any error message you received..."
            rows={3}
          />

          <label htmlFor="interpretation">What do you think it means?</label>
          <textarea
            id="interpretation"
            value={interpretation}
            onChange={(e) => setInterpretation(e.target.value)}
            placeholder="Your interpretation of the error or problem..."
            rows={3}
            required
          />

          <label htmlFor="question">Your Question</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would you like to ask?"
            rows={3}
            required
          />

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <AskContent />
    </Suspense>
  );
}
