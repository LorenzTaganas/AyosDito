import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ClipboardList,
  Flag,
  Heart,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  Star,
  Store,
  Tags,
  UserRound,
  UsersRound,
  Wrench,
  ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Role } from '@shared/contracts';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Brand';
import { DemoBadge } from '@/components/ui/Verification';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const CUSTOMER_NAV: NavItem[] = [
  { to: '/customer/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/customer/requests', label: 'My requests', icon: ClipboardList },
  { to: '/customer/requests/new', label: 'New request', icon: PlusCircle, end: true },
  { to: '/customer/favorites', label: 'Saved providers', icon: Heart },
  { to: '/customer/profile', label: 'Profile & security', icon: UserRound },
];

const PROVIDER_NAV: NavItem[] = [
  { to: '/provider/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/provider/requests', label: 'Requests & quotes', icon: ClipboardList },
  { to: '/provider/services', label: 'Services & pricing', icon: Wrench },
  { to: '/provider/reviews', label: 'Reviews', icon: Star },
  { to: '/provider/verification', label: 'Verification', icon: ShieldCheck },
  { to: '/provider/profile', label: 'Profile & portfolio', icon: UserRound },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/providers', label: 'Provider approvals', icon: Store },
  { to: '/admin/verifications', label: 'Verification checks', icon: ShieldCheck },
  { to: '/admin/users', label: 'Users & roles', icon: UsersRound },
  { to: '/admin/reports', label: 'Reports queue', icon: Flag },
  { to: '/admin/reviews', label: 'Review moderation', icon: Star },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/locations', label: 'Locations', icon: MapPin },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
];

const ROLE_NAV: Record<Role, NavItem[]> = {
  CUSTOMER: CUSTOMER_NAV,
  PROVIDER: PROVIDER_NAV,
  ADMIN: ADMIN_NAV,
};

const APPROVAL_LABELS = {
  PENDING: 'Application under review',
  APPROVED: 'Approved provider',
  REJECTED: 'Application needs changes',
} as const;

export function DashboardLayout({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const navItems = ROLE_NAV[role];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      toast.success('You have been signed out.');
      navigate('/');
    } catch {
      toast.error('Could not sign out. Check your connection and try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (!user) return null;

  const provider = user.provider;
  const approvalTone =
    provider?.approvalStatus === 'APPROVED'
      ? 'brand'
      : provider?.approvalStatus === 'REJECTED'
        ? 'danger'
        : 'sun';

  return (
    <div className="min-h-dvh bg-paper">
      <div className="border-b border-brand-900 bg-brand-950 text-brand-100">
        <div className="page-shell flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1.5 text-center text-[11px] font-medium leading-relaxed text-brand-100/80 sm:text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 text-sun" aria-hidden="true" />
          <span>MVP demo. No payments are processed through AyosDito.</span>
          <Link to="/how-it-works#trust" className="font-semibold text-sun underline underline-offset-2">
            What this means
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-paper-soft/95 backdrop-blur">
        <div className="page-shell flex h-16 items-center gap-3">
          <Logo />
          <Badge variant="outline" className="hidden sm:inline-flex">
            {role === 'CUSTOMER' ? 'Customer account' : role === 'PROVIDER' ? 'Provider account' : 'Admin account'}
          </Badge>
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              to="/"
              className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View site
            </Link>
            <span className="hidden items-center gap-2 border-l border-line pl-3 lg:flex">
              <Avatar name={user.fullName} imageUrl={provider?.profileImage} size="sm" />
              <span className="max-w-[10rem] truncate text-sm font-semibold">{user.fullName}</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className={buttonStyles({ variant: 'ghost', size: 'icon' })}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav className="page-shell flex gap-1 overflow-x-auto pb-2 lg:hidden" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold',
                    isActive ? 'bg-brand-700 text-white' : 'bg-paper-soft text-ink-soft hover:bg-paper-deep',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <div className="page-shell grid gap-6 py-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <div className="card-surface p-4">
              <div className="flex items-center gap-3">
                <Avatar name={user.fullName} imageUrl={provider?.profileImage} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{user.fullName}</p>
                  <p className="truncate text-xs text-ink-mute">{user.email}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.isDemo ? <DemoBadge label="Demo account" /> : null}
                {provider ? (
                  <Badge variant={approvalTone}>{APPROVAL_LABELS[provider.approvalStatus]}</Badge>
                ) : null}
                {!user.emailVerified ? <Badge variant="danger">Email not verified</Badge> : null}
              </div>
            </div>

            <nav className="card-surface overflow-hidden p-2" aria-label="Dashboard sections">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                        isActive
                          ? 'bg-brand-50 text-brand-800'
                          : 'text-ink-soft hover:bg-paper-deep hover:text-ink',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
              <p className="font-bold text-ink">
                {role === 'ADMIN' ? 'Every decision is recorded' : 'Keep it on AyosDito'}
              </p>
              <p className="mt-1">
                {role === 'ADMIN'
                  ? 'Approvals, suspensions, moderation decisions, and catalog changes are written to the audit log with your administrator account.'
                  : 'Keep requests, quotes, and reviews on the platform so there is a clear record if something goes wrong. Payments are arranged directly with the provider.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-semibold text-brand-800">
                {role === 'ADMIN' ? (
                  <>
                    <Link to="/admin/audit" className="underline underline-offset-2">
                      Audit log
                    </Link>
                    <Link to="/privacy" className="underline underline-offset-2">
                      Privacy
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/how-it-works" className="underline underline-offset-2">
                      How it works
                    </Link>
                    <Link to="/privacy" className="underline underline-offset-2">
                      Privacy
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>

        <main id="dashboard-main" className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
