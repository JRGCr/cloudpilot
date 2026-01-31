import { useAuthActions, useUser } from '../lib/hooks';

export function Dashboard() {
  const user = useUser();
  const { logout } = useAuthActions();

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Dashboard</h1>
        <button type="button" onClick={logout} className="btn btn-secondary">
          Sign out
        </button>
      </header>

      <section
        style={{
          background: 'var(--color-surface)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user?.image && (
            <img
              src={user.image}
              alt={user.name || 'User'}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
              }}
            />
          )}
          <div>
            <p style={{ fontWeight: 500, fontSize: '1.125rem' }}>{user?.name || 'Anonymous'}</p>
            <p style={{ color: 'var(--color-text-muted)' }}>{user?.email}</p>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: '1.5rem',
          background: 'var(--color-surface)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
          Quick Actions
        </h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Your CloudPilot dashboard is ready. Start deploying applications to Cloudflare.
        </p>
      </section>
    </div>
  );
}
