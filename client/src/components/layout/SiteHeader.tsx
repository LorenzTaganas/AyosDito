import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { dashboardPath } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Brand';

const NAV_ITEMS = [
  { to: '/services', label: 'Services' },
  { to: '/providers', label: 'Find providers' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/become-a-provider', label: 'For providers' },
];

export function SiteHeader() {
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

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

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-lg px-3 py-2 text-sm font-semibold transition',
      isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-paper-deep hover:text-ink',
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {isLoading ? (
            <div className="h-9 w-28 animate-pulse rounded-xl bg-paper-deep" aria-hidden="true" />
          ) : user ? (
            <>
              <Link to={dashboardPath(user.role)} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Dashboard
              </Link>
              <span className="ml-1 hidden items-center gap-2 lg:flex">
                <Avatar name={user.fullName} imageUrl={user.provider?.profileImage} size="sm" />
                <span className="max-w-[9rem] truncate text-sm font-semibold">{user.fullName.split(' ')[0]}</span>
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
            </>
          ) : (
            <>
              <Link to="/login" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
                Log in
              </Link>
              <Link to="/register" className={buttonStyles({ variant: 'primary', size: 'sm' })}>
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Sign up
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className={buttonStyles({ variant: 'ghost', size: 'icon', className: 'md:hidden' })}
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-line bg-paper-soft md:hidden">
          <nav className="page-shell flex flex-col gap-1 py-3" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2.5 text-sm font-semibold',
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-paper-deep',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-line pt-3">
              {user ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Avatar name={user.fullName} imageUrl={user.provider?.profileImage} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.fullName}</p>
                      <p className="truncate text-xs capitalize text-ink-mute">{user.role.toLowerCase()}</p>
                    </div>
                  </div>
                  <Link
                    to={dashboardPath(user.role)}
                    className={buttonStyles({ variant: 'secondary', size: 'md', fullWidth: true })}
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    Go to dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className={buttonStyles({ variant: 'ghost', size: 'md', fullWidth: true })}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Log out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" className={buttonStyles({ variant: 'secondary', size: 'md', fullWidth: true })}>
                    Log in
                  </Link>
                  <Link to="/register" className={buttonStyles({ variant: 'primary', size: 'md', fullWidth: true })}>
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
