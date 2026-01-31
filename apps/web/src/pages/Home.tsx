import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthActions, useIsAuthLoading, useIsAuthenticated } from '../lib/hooks';

export function Home() {
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useIsAuthLoading();
  const { login } = useAuthActions();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleLogin = async () => {
    try {
      setIsSigningIn(true);
      await login();
    } catch (_error) {
      // Error is logged by the store
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ marginBottom: '0.5rem', fontSize: '3rem', fontWeight: 700 }}>CloudPilot</h1>
      <p
        style={{
          color: 'var(--color-text-muted)',
          marginBottom: '2rem',
          textAlign: 'center',
          maxWidth: '400px',
          fontSize: '1.125rem',
        }}
      >
        Autonomous deployment platform for Claude Code on Cloudflare
      </p>
      <button
        type="button"
        onClick={handleLogin}
        disabled={isSigningIn}
        className="btn btn-primary"
        style={{
          padding: '0.875rem 2rem',
          fontSize: '1rem',
        }}
      >
        {isSigningIn ? 'Signing in...' : 'Sign in with GitHub'}
      </button>
    </div>
  );
}
