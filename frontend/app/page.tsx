'use client';

import { useAuth } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';
import StudentList from '@/components/StudentList';

export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="main-app">
      {!user ? (
        <LoginForm />
      ) : (
        <StudentList />
      )}
    </div>
  );
}
