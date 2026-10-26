import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { buttonStyles } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Brand';
import { ProvidersDirectory } from '@/components/providers/ProvidersDirectory';

export function ProvidersPage() {
  useDocumentTitle('Find providers');
  return (
    <div className="page-shell py-10 sm:py-14">
      <nav className="mb-6 text-xs font-medium text-ink-mute" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">
          Home
        </Link>
        <span className="mx-1.5" aria-hidden="true">
          /
        </span>
        <span aria-current="page" className="text-ink-soft">
          Providers
        </span>
      </nav>

      <PageHeader
        eyebrow="Provider directory"
        title="Find local help you can compare."
        description="Search approved providers with an active service and a supported service area. Filter by category, location, estimate, rating, or verification. Results show only live database records."
        actions={
          <Link to="/services" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            Browse services
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-brand-900">
          <strong className="font-bold">Rankings are not sold.</strong> The default order uses review
          signals, verification state, and account age. No sponsored listings are inserted. A
          verification badge means a check happened; it is not a guarantee of work quality.
        </p>
      </div>

      <div className="mt-8">
        <ProvidersDirectory hideHeading />
      </div>
    </div>
  );
}
