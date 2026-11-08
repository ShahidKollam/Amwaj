import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/20 mb-4">
            <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
              <path d="M32 14c-2 6-6 10-10 14 4 2 8 4 10 8 2-4 6-6 10-8-4-4-8-8-10-14z" fill="#C69A50"/>
              <circle cx="32" cy="42" r="6" fill="#FAF8F3" opacity="0.9"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Amwaj</h1>
          <p className="text-gold mt-1 font-medium">POS</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-ivory rounded-3xl p-6 shadow-card space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-white/60 text-xs mt-8">
          Internal staff access only
        </p>
      </div>
    </div>
  );
}
