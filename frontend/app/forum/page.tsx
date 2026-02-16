'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useHeader } from '@/lib/header-context';

interface Comment {
  id: number;
  account_name: string | null;
  comment: string;
  created_at: string;
}

interface Question {
  id: number;
  student_name: string;
  error: string | null;
  interpretation: string | null;
  question: string;
  work: string | null;
  created_at: string;
  comments: Comment[];
}

export default function ForumPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { setParentPath } = useHeader();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  // Track comment input per question
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  // Track which question is submitting a comment
  const [submittingComment, setSubmittingComment] = useState<Record<number, boolean>>({});

  // Set back button to home
  useEffect(() => {
    setParentPath('/');
    return () => setParentPath(null);
  }, [setParentPath]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [isLoading, user, router]);

  // Fetch questions
  useEffect(() => {
    if (!user) return;
    setFetching(true);
    fetch('/api/get_questions', {
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Failed to load questions');
        }
        return res.json();
      })
      .then((data) => setQuestions(data))
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false));
  }, [user]);

  const handleCommentChange = (questionId: number, value: string) => {
    setCommentInputs((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCommentSubmit = async (questionId: number) => {
    const commentText = commentInputs[questionId]?.trim();
    if (!commentText) return;

    setSubmittingComment((prev) => ({ ...prev, [questionId]: true }));

    try {
      const res = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          question_id: questionId,
          comment: commentText,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to post comment');
      }

      const created_at = await res.text(); // server returns created_at as string

      // Create a temporary comment object with the current user's name
      const newComment: Comment = {
        id: -Date.now(), // temporary negative ID
        account_name: user, // current logged-in username
        comment: commentText,
        created_at,
      };

      // Update the questions state with the new comment
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, comments: [...q.comments, newComment] }
            : q
        )
      );

      // Clear the input
      setCommentInputs((prev) => ({ ...prev, [questionId]: '' }));
    } catch (err) {
      alert('Error posting comment: ' + err);
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, questionId: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommentSubmit(questionId);
    }
  };

  if (isLoading || fetching) {
    return <div className="p-8 text-center">Loading forum...</div>;
  }

  if (!user) {
    return null; // will redirect
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-accent rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="main-app">
      <h1 className="text-3xl text-accent mb-6">Forum</h1>
      {questions.length === 0 ? (
        <p className="text-muted">No questions yet. Be the first to ask!</p>
      ) : (
        <div className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="card">
              {/* Question header with student name and date */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl text-accent-2">{q.question}</h2>
                  <p className="text-sm text-muted">Asked by {q.student_name}</p>
                </div>
                <span className="chip chip-soft text-sm">
                  {formatDate(q.created_at)}
                </span>
              </div>

              {/* Error and interpretation (if any) */}
              {(q.error || q.interpretation) && (
                <div className="mb-4 p-3 bg-panel-2 rounded border border-border">
                  {q.error && (
                    <div className="mb-2">
                      <span className="font-bold text-danger">Error:</span>{' '}
                      <code className="text-sm bg-black/30 px-2 py-1 rounded">
                        {q.error}
                      </code>
                    </div>
                  )}
                  {q.interpretation && (
                    <div>
                      <span className="font-bold text-accent">Interpretation:</span>{' '}
                      {q.interpretation}
                    </div>
                  )}
                </div>
              )}

              {/* Work snippet (if any) */}
              {q.work && (
                <div className="mb-4">
                  <details className="text-sm">
                    <summary className="cursor-pointer text-accent hover:underline">
                      View related work
                    </summary>
                    <pre className="mt-2 p-3 bg-black/30 rounded border border-border overflow-x-auto">
                      <code>{q.work}</code>
                    </pre>
                  </details>
                </div>
              )}

              {/* Comments section */}
              <div className="mt-4">
                <h3 className="text-md font-semibold text-muted mb-2">
                  Comments ({q.comments.length})
                </h3>
                {q.comments.length === 0 ? (
                  <p className="text-muted italic">No comments yet.</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {q.comments.map((c) => (
                      <div key={c.id} className="pl-4 border-l-2 border-accent/30">
                        <p className="text-sm">{c.comment}</p>
                        <p className="text-xs text-muted mt-1">
                          {formatDate(c.created_at)}
                          {c.account_name ? ` · ${c.account_name}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add comment form */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={commentInputs[q.id] || ''}
                    onChange={(e) => handleCommentChange(q.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, q.id)}
                    className="flex-1 px-3 py-2 bg-panel border border-border rounded focus:outline-none focus:border-accent"
                    disabled={submittingComment[q.id]}
                  />
                  <button
                    onClick={() => handleCommentSubmit(q.id)}
                    disabled={!commentInputs[q.id]?.trim() || submittingComment[q.id]}
                    className="px-4 py-2 bg-accent text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingComment[q.id] ? '...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
