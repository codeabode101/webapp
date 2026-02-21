'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useHeader } from '@/lib/header-context';
import { useStudent } from '@/lib/student-context';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'rehype-sanitize';

// Separate component that uses useSearchParams
function ClassworkContent() {
  const searchParams = useSearchParams();
  const classId = searchParams.get('c');
  const typeParam = searchParams.get('t'); // 'cw' or 'hw'
  const studentId = searchParams.get('s');

  // Convert typeParam back to full string if needed for API calls
  const type = typeParam === 'cw' ? 'classwork' : 'homework';
  const { user } = useAuth();
  const { setParentPath } = useHeader();
  const { getStudent } = useStudent();

  const [content, setContent] = useState('');
  const [submission, setSubmission] = useState('');
  const [work, setWork] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [submissionVisible, setSubmissionVisible] = useState(false);

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Optionally read the file content immediately or wait for submit
    }
  };

  // Clear file input (used after submit)
  const clearFileInput = () => {
    setFile(null);
    // Reset the file input value to allow re-selecting same file
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const schema = {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames || []),
      'details',
      'summary',
      // Add any other tags you need (e.g., 'iframe' is NOT recommended)
    ],
    attributes: {
      ...defaultSchema.attributes,
      details: ['open'], // allow the 'open' attribute on <details>
      summary: [],
    },
  };

  useEffect(() => {
    if (studentId) {
      setParentPath(`/student?id=${studentId}`);
    } else {
      setParentPath('/'); // fallback
    }
    return () => setParentPath(null);
  }, [studentId, setParentPath]);

  useEffect(() => {
    if (!classId || !studentId || !user) return;

    const studentIdNum = Number(studentId);
    const cachedStudent = getStudent(studentIdNum);

    if (cachedStudent) {
      // Use cached data
      const classItem = cachedStudent.classes.find((c: any) => c.class_id === Number(classId));
      if (classItem) {
        setContent(type === 'classwork' ? classItem.classwork : classItem.hw);
        setSubmission(type === 'classwork' ? classItem.classwork_submission : classItem.homework_submission);
      } else {
        setContent('Class not found');
      }
    } else {
      // Fetch student data (fallback, e.g., if user came directly to work page)
      fetch(`/api/get_student/${studentIdNum}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
        .then(res => res.json())
        .then(data => {
          const classItem = data.classes.find((c: any) => c.class_id === Number(classId));
          if (classItem) {
            setContent(type === 'classwork' ? classItem.classwork : classItem.hw);
            setSubmission(type === 'classwork' ? classItem.classwork_submission : classItem.homework_submission);
          } else {
            setContent('Class not found');
          }
        })
        .catch(console.error);
    }
  }, [classId, studentId, type, user, getStudent]);

  const handleSubmit = async () => {
    let workText = work;
    if (file) {
      workText = await file.text();
    }
    const res = await fetch(`/api/submit/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ class_id: Number(classId), work: workText }),
    });
    if (res.ok) {
      alert('Submitted');
      setSubmission(workText);
      setSubmissionVisible(true); // show the submitted work
      setWork('');
      setFile(null);
      clearFileInput();
    } else {
      alert(await res.text());
    }
  };

  if (!classId) return <div className="p-8">No class ID provided.</div>;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 p-4 lg:p-8 w-full min-h-screen">
        { content && content.trim() !== '' && (
          <div className="flex-1 overflow-y-auto p-4 bg-black/20 rounded-2xl whitespace-pre-wrap break-words max-lg:max-h-[50vh] max-h-screen h-full">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        <div className="upload-section">
          <div className="upload-header">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 md:flex-nowrap max-sm:flex-col max-sm:w-full">
              {submission && (
                <>
                  <Link
                    href={`/ask?c=${classId}&t=${type}&s=${studentId}`}
                    className="px-3 py-1.5 rounded-lg font-semibold text-base border border-[#d63384] text-[#d63384] bg-transparent hover:bg-[#d63384] hover:text-white transition-colors max-sm:w-full text-center"
                  >
                    Ask
                  </Link>
                  <Link
                    href={`/publish?c=${classId}&t=${typeParam}&s=${studentId}`}
                    className="px-3 py-1.5 rounded-lg font-semibold text-base border border-[#eab308] text-[#eab308] bg-transparent hover:bg-[#eab308] hover:text-white transition-colors max-sm:w-full text-center"
                  >
                    Publish
                  </Link>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg font-semibold text-base border border-[var(--accent-2)] text-[var(--accent-2)] bg-transparent hover:bg-[var(--accent-2)] hover:text-black transition-colors max-sm:w-full"
                    onClick={() => setSubmissionVisible(!submissionVisible)}
                  >
                    My Work
                  </button>
                </>
              )}
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg font-semibold text-base border border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)] hover:text-white transition-colors max-sm:w-full"
                onClick={handleSubmit}
              >
                Upload
              </button>
            </div>
          </div>

          {submissionVisible && submission && (
            <div className="submission-code">
              <pre><code>{submission}</code></pre>
            </div>
          )}

          <div
            className="file-upload-box"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {file ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                <div><strong>{file.name}</strong></div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {(file.size / 1024).toFixed(2)} KB
                </div>
              </div>
            ) : (
              <span>Click to upload file or drag & drop</span>
            )}
            <input
              type="file"
              id="file-input"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className="or-divider">OR</div>

          <textarea
            className="text-input-box"
            placeholder="Copy and paste your work here..."
            value={work}
            onChange={(e) => setWork(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

// Main page component with Suspense boundary
export default function ClassworkPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading classwork...</div>}>
      <ClassworkContent />
    </Suspense>
  );
}
