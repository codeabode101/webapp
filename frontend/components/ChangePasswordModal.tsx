'use client';

import { useState } from 'react';

export default function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('Updating password…');

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          username,
          password: currentPassword,
          new_password: newPassword,
        }),
      });

      const text = await res.text();

      if (res.ok) {
        setStatus(text || 'Password updated successfully.');
        // Clear form
        setUsername('');
        setCurrentPassword('');
        setNewPassword('');
        // Reload after a short delay to clear cookies and reflect logout
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else if (res.status === 401) {
        setStatus('Incorrect password.');
      } else {
        setStatus(`Update failed: ${text}`);
      }
    } catch (err) {
      setStatus('Network error. See console.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Optionally reset form when closing
    setUsername('');
    setCurrentPassword('');
    setNewPassword('');
    setStatus('');
    onClose();
  };

  return (
    <div className="modal active" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Change Password</h2>
          <button onClick={handleClose} className="close-modal">&times;</button>
        </div>
        <p className="small">Enter your username, current password, and a new password.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="cp-username">Username</label>
          <input
            id="cp-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label htmlFor="cp-current">Current Password</label>
          <input
            id="cp-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <label htmlFor="cp-new">New Password</label>
          <input
            id="cp-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        <div className={`status ${status.includes('successfully') ? 'ok' : status.includes('failed') ? 'err' : ''}`}>
          {status || '—'}
        </div>
      </div>
    </div>
  );
}
