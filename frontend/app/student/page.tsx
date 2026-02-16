'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useHeader } from '@/lib/header-context';
import StudentDetail from '@/components/StudentDetail';
import { useStudent } from '@/lib/student-context';

// Inner component that uses useSearchParams
function StudentContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { user, refresh } = useAuth();
  const { setParentPath } = useHeader();
  const { setStudent: cacheStudent } = useStudent(); 
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting parent path to /');
    setParentPath('/');
    return () => setParentPath(null); // clear when leaving
  }, [setParentPath]);

  useEffect(() => {
    if (!user || !id) {
      setLoading(false);
      return;
    }
    fetch(`/api/get_student/${id}`, {
      method: 'POST',
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (res.status === 404) {
          refresh();
          return null;
        }
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(data => {
        setStudent(data);
        if (data) {
          cacheStudent(Number(id), data);   // cache it
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, user, refresh, cacheStudent]);

  if (loading) return <div className="p-8">Loading student...</div>;
  if (!user) return <div className="p-8">Please log in.</div>;
  if (!id) return <div className="p-8">No student ID provided.</div>;
  if (!student) return <div className="p-8">Student not found.</div>;

  return (
    <div className="main-app">
      <StudentDetail student={student} />
    </div>
  );
}

// Default export – now correctly wrapped in Suspense
export default function StudentPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading student page...</div>}>
      <StudentContent />
    </Suspense>
  );
}
