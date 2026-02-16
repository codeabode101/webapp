'use client';

import { useAuth } from '@/lib/auth';
import { useState } from 'react';

export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Signing in…');
    try {
      await login(username, password);
      setStatus('Login successful');
    } catch (err: any) {
      setStatus(err.message || 'Login failed');
    }
  };

  return (
    <section className="card">
      <h2>Login</h2>
      <p className="small">Use your CodeAbode account credentials.</p>
      <form onSubmit={handleSubmit}>
        <label>Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      <div className={`status ${status.includes('success') ? 'ok' : status.includes('fail') ? 'err' : ''}`}>
        {status || 'Not signed in.'}
      </div>
    </section>
  );
}
