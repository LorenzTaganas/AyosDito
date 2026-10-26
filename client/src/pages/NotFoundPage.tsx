import { Link } from 'react-router-dom';
import { Compass, Home, Search } from 'lucide-react';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { IconTile } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="page-shell flex min-h-[62vh] items-center py-14">
      <div className="mx-auto max-w-xl text-center">
        <IconTile icon={Compass} size="lg" className="mx-auto" />
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">404</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          This page is not part of the job.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          The address may be wrong, or the page may have moved. Head back home, browse the service
          catalog, or search the provider directory.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/" className={buttonStyles({ variant: 'primary', size: 'md' })}>
            <Home className="h-4 w-4" aria-hidden="true" />
            Back home
          </Link>
          <Link to="/services" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            Browse services
          </Link>
          <Link to="/providers" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Find providers
          </Link>
        </div>
      </div>
    </div>
  );
}
