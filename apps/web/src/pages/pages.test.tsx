/**
 * Tests for page components (Home, Dashboard, Logs)
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as hooks from '../lib/hooks';
import { Dashboard } from './Dashboard';
import { Home } from './Home';
import { Logs } from './Logs';

// Mock the hooks module
vi.mock('../lib/hooks', () => ({
  useUser: vi.fn(),
  useSession: vi.fn(),
  useIsAuthenticated: vi.fn(),
  useIsAuthLoading: vi.fn(),
  useAuthError: vi.fn(),
  useAuthActions: vi.fn(),
}));

describe('Home Page', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.mocked(hooks.useAuthActions).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      fetchSession: vi.fn(),
    });
  });

  test('renders home page with title and description', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(false);
    vi.mocked(hooks.useIsAuthLoading).mockReturnValue(false);

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: /cloudpilot/i })).toBeInTheDocument();
    expect(screen.getByText(/autonomous deployment platform for claude code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
  });

  test('shows loading state while checking authentication', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(false);
    vi.mocked(hooks.useIsAuthLoading).mockReturnValue(true);

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>,
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  test('redirects to dashboard when authenticated', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(true);
    vi.mocked(hooks.useIsAuthLoading).mockReturnValue(false);

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>,
    );

    // When authenticated, should navigate to /dashboard
    // Since we're using BrowserRouter in test, the Navigate component will render
    // but won't actually navigate. We just verify login button isn't shown
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  test('calls login when sign in button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(false);
    vi.mocked(hooks.useIsAuthLoading).mockReturnValue(false);

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>,
    );

    const signInButton = screen.getByRole('button', { name: /sign in with github/i });
    await user.click(signInButton);

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard Page', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.mocked(hooks.useAuthActions).mockReturnValue({
      login: vi.fn(),
      logout: mockLogout,
      fetchSession: vi.fn(),
    });
  });

  test('renders dashboard with user profile', () => {
    vi.mocked(hooks.useUser).mockReturnValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      image: 'https://example.com/avatar.jpg',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  test('renders dashboard with user image', () => {
    vi.mocked(hooks.useUser).mockReturnValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      image: 'https://example.com/avatar.jpg',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

    const avatar = screen.getByAltText('Test User');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  test('renders anonymous when no user name', () => {
    vi.mocked(hooks.useUser).mockReturnValue({
      id: 'user-1',
      name: null,
      email: 'test@example.com',
      emailVerified: true,
      image: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

    expect(screen.getByText('Anonymous')).toBeInTheDocument();
  });

  test('calls logout when sign out button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(hooks.useUser).mockReturnValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      image: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

describe('Logs Page', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.mocked(hooks.useAuthActions).mockReturnValue({
      login: vi.fn(),
      logout: mockLogout,
      fetchSession: vi.fn(),
    });
  });

  test('redirects to home when not authenticated', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(false);

    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>,
    );

    // When not authenticated, should navigate to /
    // Verify logs page content isn't shown
    expect(screen.queryByRole('heading', { name: /logs/i })).not.toBeInTheDocument();
  });

  test('renders logs page when authenticated', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(true);

    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: /logs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/auto-refresh/i)).toBeInTheDocument();
  });

  test('shows empty state for logs', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(true);

    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>,
    );

    // Should show empty log viewer
    expect(screen.getByText('No log entries found')).toBeInTheDocument();
  });

  test('toggles auto-refresh checkbox', async () => {
    const user = userEvent.setup();
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(true);

    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>,
    );

    const checkbox = screen.getByLabelText(/auto-refresh/i);
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  test('calls logout when sign out is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(true);

    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>,
    );

    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test('displays footer with log info', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(true);

    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>,
    );

    expect(screen.getByText(/logs are stored locally/i)).toBeInTheDocument();
    expect(screen.getByText(/pnpm logs:query/i)).toBeInTheDocument();
  });

  test('has navigation links', () => {
    vi.mocked(hooks.useIsAuthenticated).mockReturnValue(true);

    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>,
    );

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const logsLink = screen.getByRole('link', { name: /logs/i });

    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    expect(logsLink).toHaveAttribute('href', '/logs');
  });
});
