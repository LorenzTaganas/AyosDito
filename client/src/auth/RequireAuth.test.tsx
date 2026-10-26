import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@shared/api-types';
import type { Role } from '@shared/contracts';
import { RequireAuth } from './RequireAuth';
import { useAuth } from './AuthProvider';

vi.mock('./AuthProvider', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function authUser(role: Role): AuthUser {
  return {
    id: 'user_1',
    fullName: role === 'ADMIN' ? 'AyosDito Admin' : 'Maria Santos',
    email: 'user@ayosdito.test',
    role,
    accountStatus: 'ACTIVE',
    emailVerified: true,
    isDemo: true,
    createdAt: '2026-10-26T00:00:00.000Z',
    preferredLocationId: null,
    provider: null,
  };
}

function signedIn(user: AuthUser | null, isLoading = false) {
  mockedUseAuth.mockReturnValue({
    user,
    isLoading,
    refresh: vi.fn(),
    setUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  });
}

function LoginProbe() {
  const [params] = useSearchParams();
  return <p>Login page. next={params.get('next')}</p>;
}

function renderGuard(roles: Role[], initialEntry = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<RequireAuth roles={roles} />}>
          <Route path="/admin/dashboard" element={<p>Admin area</p>} />
        </Route>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/customer/dashboard" element={<p>Customer area</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signedIn(null);
});

describe('RequireAuth', () => {
  it('sends signed-out visitors to login and preserves the intended path', () => {
    renderGuard(['ADMIN'], '/admin/dashboard?tab=reports');
    expect(screen.getByText('Login page. next=/admin/dashboard?tab=reports')).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  it('shows a loading state while the session is being checked', () => {
    signedIn(null, true);
    renderGuard(['ADMIN']);
    expect(screen.getByText('Loading AyosDito…')).toBeInTheDocument();
    expect(screen.queryByText('Login page. next=/admin/dashboard')).not.toBeInTheDocument();
  });

  it('blocks a signed-in account whose role does not match', () => {
    signedIn(authUser('CUSTOMER'));
    renderGuard(['ADMIN']);

    expect(screen.getByRole('heading', { name: 'This area is not available for your role' })).toBeInTheDocument();
    expect(screen.getByText(/signed in as a customer/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to my dashboard' })).toHaveAttribute(
      'href',
      '/customer/dashboard',
    );
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  it('renders the protected route for an allowed role', () => {
    signedIn(authUser('ADMIN'));
    renderGuard(['ADMIN']);
    expect(screen.getByText('Admin area')).toBeInTheDocument();
  });

  it('allows access when the account holds any one of the allowed roles', () => {
    signedIn(authUser('PROVIDER'));
    renderGuard(['CUSTOMER', 'PROVIDER']);
    expect(screen.getByText('Admin area')).toBeInTheDocument();
  });
});
