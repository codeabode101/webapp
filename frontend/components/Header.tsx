'use client';

import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { useHeader } from '@/lib/header-context';
import Link from 'next/link';
import ChangePasswordModal from './ChangePasswordModal';

export default function Header() {
  const { user } = useAuth();
  const { parentPath } = useHeader();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <header className="flex justify-between items-center p-5 sticky top-0 z-10 bg-panel border-b border-border shadow-lg">
      <div className="flex items-center gap-4">
        {parentPath ? (
          <Link href={parentPath} className="back-btn">
            ← Back
          </Link>
        ) : (
          <h1 className="text-2xl text-accent">
            <strong>{user ? `Welcome, ${user}!` : 'Welcome to Codeabode'}</strong>
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Link href="/forum" className="nav-link"><strong>Forum</strong></Link>
        {user && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="nav-link"
          >
            <strong>Change Password</strong>
          </button>
        )}
      </div>

      <ChangePasswordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </header>
  );
}
