import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { Role } from '@shared/contracts';
import { dashboardPath } from '@/lib/format';
import { useAuth } from './AuthProvider';
import { PageLoader } from '@/components/ui/Feedback';
import { buttonStyles } from '@/components/ui/Button';

export function RequireAuth({ roles }: { roles: Role[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <PageLoader />
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <div className="max-w-md rounded-2xl border border-line bg-paper-soft p-8 text-center shadow-card">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-clay-soft text-clay">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold">This area is not available for your role</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            You are signed in as a {user.role.toLowerCase()}. This page is restricted to{' '}
            {roles.map((role) => role.toLowerCase()).join(' or ')} accounts, and the server enforces
            the same rule.
          </p>
          <Link
            to={dashboardPath(user.role)}
            className={buttonStyles({ variant: 'primary', size: 'md', className: 'mt-5' })}
          >
            Go to my dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
