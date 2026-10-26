import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Eye,
  ImagePlus,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  ShieldQuestion,
  UserRound,
} from 'lucide-react';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/ui/Brand';
import { IconTile } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const STEPS = [
  {
    icon: UserRound,
    title: 'Create a provider account',
    description:
      'Register with your own name, sign-in email, and the business or display name customers will see. You can use your real name if you work independently.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Build your service profile',
    description:
      'Add a profile photo, a description, service areas, at least one active service with a price guide, and optional portfolio photos.',
  },
  {
    icon: Eye,
    title: 'Wait for administrator review',
    description:
      'New provider profiles start as Pending. An administrator reviews the details before your profile appears in the public directory. There is no auto-approval.',
  },
  {
    icon: BadgeCheck,
    title: 'Optionally request verification',
    description:
      'After approval, you may submit an identity or business verification request. A badge appears only after a separate administrator review.',
  },
];

const CHECKLIST = [
  { icon: ImagePlus, label: 'A clear profile photo' },
  { icon: ClipboardList, label: 'A description of at least 40 characters' },
  { icon: MapPin, label: 'At least one active service area' },
  { icon: BriefcaseBusiness, label: 'At least one active service listing' },
  { icon: ShieldCheck, label: 'An optional verification request' },
];

export function BecomeProviderPage() {
  useDocumentTitle('Become a provider');
  const { user } = useAuth();

  return (
    <div className="page-shell py-10 sm:py-14">
      <PageHeader
        eyebrow="For local providers"
        title="Turn repair skills into a clear online profile."
        description="AyosDito gives local technicians and service businesses a structured place to show their services, receive quote requests, and manage jobs. It is free in this MVP, and it does not sell rankings or guarantee bookings."
        actions={
          user?.role === 'PROVIDER' ? (
            <Link to="/provider/dashboard" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Go to provider dashboard
            </Link>
          ) : (
            <Link to="/register?role=provider" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              Create a provider account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )
        }
      />

      {user && user.role !== 'PROVIDER' ? (
        <Alert tone="warning" className="mt-6">
          You are signed in as a {user.role.toLowerCase()}. Provider accounts are separate; sign out
          first if you want to register a provider account with a different email.
        </Alert>
      ) : null}

      <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_21rem]">
        <div className="space-y-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="card-surface flex gap-4 p-5 sm:p-6">
              <div className="flex flex-col items-center">
                <IconTile icon={step.icon} />
                {index < STEPS.length - 1 ? (
                  <span className="mt-2 w-px flex-1 bg-line" aria-hidden="true" />
                ) : null}
              </div>
              <div className="pb-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Step {index + 1}</p>
                <h2 className="mt-1 text-base font-bold">{step.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface overflow-hidden">
            <div className="ticket-top h-1.5" aria-hidden="true" />
            <div className="p-5">
              <h2 className="text-base font-bold">Profile checklist</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                The dashboard tracks these five items. They improve the information customers can
                review; they do not guarantee visibility or jobs.
              </p>
              <ul className="mt-4 space-y-2.5">
                {CHECKLIST.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5 text-xs text-ink-soft">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-sun/40 bg-sun-soft/60 p-4">
            <p className="flex gap-2 text-xs leading-relaxed text-sun-deep">
              <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Approval is not verification. A provider account never becomes “verified” automatically,
                and an approved profile is not a promise of quality.
              </span>
            </p>
          </div>

          {user?.role === 'PROVIDER' ? (
            <div className="card-surface p-5">
              <p className="text-sm font-bold">You already have a provider account</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Approval status: {user.provider?.approvalStatus.toLowerCase() ?? 'pending'}.
              </p>
              <Link
                to="/provider/dashboard"
                className={buttonStyles({ variant: 'primary', size: 'sm', fullWidth: true, className: 'mt-3' })}
              >
                Open provider dashboard
              </Link>
            </div>
          ) : (
            <div className="card-surface p-5">
              <p className="text-sm font-bold">Start with an account</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                No registration fee in this MVP. You will need a working email address to receive
                verification and password-reset links when email delivery is configured.
              </p>
              <Link
                to="/register?role=provider"
                className={buttonStyles({ variant: 'primary', size: 'sm', fullWidth: true, className: 'mt-3' })}
              >
                Sign up as a provider
              </Link>
            </div>
          )}
        </aside>
      </div>

      <section className="mt-12 grid gap-4 md:grid-cols-2" aria-labelledby="provider-honesty">
        <div className="card-surface p-6">
          <h2 id="provider-honesty" className="text-lg font-bold">
            What AyosDito provides
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-soft">
            {[
              'A public profile with your services, price guides, service areas, and portfolio.',
              'Quote requests from customers who choose your category and area.',
              'One dashboard for quotes, active jobs, and customer reviews.',
              'Server-enforced account and role separation.',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-paper-deep/50 p-6">
          <h2 className="text-lg font-bold">What it does not promise</h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-soft">
            {[
              'A guaranteed number of quote requests, jobs, or income.',
              'A paid priority position in search results — rankings are not sold.',
              'Online payments, escrow, refunds, or a workmanship warranty.',
              'Automatic verification or approval of any profile.',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-mute">
            Customers and providers agree on the final price, schedule, and payment method directly.
          </p>
        </div>
      </section>

      <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-brand-900 p-6 text-brand-100 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-extrabold text-white">Ready to build your profile?</h2>
          <p className="mt-1 text-xs leading-relaxed text-brand-100/80">
            Registration takes a minute. Approval happens after you add your services and a human
            administrator reviews the profile.
          </p>
        </div>
        <Link to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/register?role=provider'} className={buttonStyles({ variant: 'sun', size: 'md', className: 'shrink-0' })}>
          {user?.role === 'PROVIDER' ? 'Open dashboard' : 'Get started'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
