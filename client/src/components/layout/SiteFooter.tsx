import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Brand';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { label: 'All services', to: '/services' },
      { label: 'Find providers', to: '/providers' },
      { label: 'How it works', to: '/how-it-works' },
    ],
  },
  {
    title: 'For providers',
    links: [
      { label: 'Join AyosDito', to: '/become-a-provider' },
      { label: 'Provider sign up', to: '/register?role=provider' },
      { label: 'Log in', to: '/login' },
    ],
  },
  {
    title: 'Legal & privacy',
    links: [
      { label: 'Privacy notice', to: '/privacy' },
      { label: 'Terms of use', to: '/terms' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-brand-950 text-brand-100">
      <div className="page-shell py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo inverted />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-100/75">
              May sira? May maaasahang aayos! AyosDito helps Filipino customers find local repair
              professionals, compare quotes, and choose with clearer information.
            </p>
            <p className="mt-5 inline-flex rounded-lg border border-brand-800 bg-brand-900/60 px-3 py-2 text-[11px] leading-relaxed text-brand-100/70">
              Demo environment. Sample providers and reviews are labeled. No payments are processed.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-brand-300">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      className="rounded text-sm text-brand-100/75 transition hover:text-white focus-visible:ring-brand-300 focus-visible:ring-offset-brand-950"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-brand-800/80 pt-6 text-xs leading-relaxed text-brand-100/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AyosDito. MVP build, not a launched commercial service.</p>
          <p>
            Sample records are labeled. Read our{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-brand-100">
              privacy notice
            </Link>{' '}
            and{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-brand-100">
              terms
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
