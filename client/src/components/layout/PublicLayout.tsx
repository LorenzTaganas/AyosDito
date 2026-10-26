import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Info } from 'lucide-react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <div className="border-b border-brand-900 bg-brand-950 text-brand-100">
        <div className="page-shell flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1.5 text-center text-[11px] font-medium leading-relaxed text-brand-100/80 sm:text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 text-sun" aria-hidden="true" />
          <span>
            MVP demo environment. Sample providers and reviews are labeled; no payments are
            processed.
          </span>
          <Link to="/how-it-works#trust" className="font-semibold text-sun underline underline-offset-2">
            What this means
          </Link>
        </div>
      </div>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
