import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Flag,
  LockKeyhole,
  MessageSquareQuote,
  ReceiptText,
  ShieldCheck,
  ShieldQuestion,
  Star,
  Wrench,
} from 'lucide-react';
import type { RequestStatus } from '@shared/contracts';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/ui/Brand';
import { IconTile } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';
import { RequestStatusBadge } from '@/lib/status';

const CUSTOMER_STEPS = [
  {
    icon: ClipboardList,
    title: 'Create a request',
    body: 'Choose a category and service location, then describe the problem. You can send the request to the provider directory broadly or target a specific provider from their profile.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Compare quotes',
    body: 'Approved providers who cover your category and area can send a price, notes, and an estimated duration. Quotes remain open until you accept or decline them.',
  },
  {
    icon: CheckCircle2,
    title: 'Accept one quote',
    body: 'Accepting assigns that provider to the job and declines the other pending quotes. Your email becomes visible to the assigned provider so they can coordinate.',
  },
  {
    icon: ReceiptText,
    title: 'Track, complete, review',
    body: 'The provider marks the job in progress and later completed. Only after completion can you leave one review for that request.',
  },
];

const STATUS_EXPLANATIONS: Record<RequestStatus, string> = {
  PENDING: 'Your request has been submitted and is waiting for the first quote.',
  RESPONDED: 'At least one provider sent a quote. Compare the price, notes, and duration.',
  ACCEPTED: 'You accepted a quote. That provider is assigned and other pending quotes are declined.',
  IN_PROGRESS: 'The assigned provider marked the work as started.',
  COMPLETED: 'The assigned provider marked the job complete. Your review form is now available.',
  CANCELLED: 'You cancelled before the job finished. Pending quotes were declined automatically.',
  DECLINED: 'You declined the remaining quotes, so the request is closed without an assigned provider.',
};

const STATUS_ORDER: RequestStatus[] = [
  'PENDING',
  'RESPONDED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'DECLINED',
];

const FAQS = [
  {
    question: 'Does AyosDito process payments?',
    answer:
      'No. This MVP does not collect deposits, hold payments in escrow, or refund money. Customers and providers arrange payment directly. Never send sensitive IDs or full payment before you are comfortable with the arrangement.',
  },
  {
    question: 'How does a provider get listed?',
    answer:
      'A provider creates an account, publishes at least one active service, chooses service areas, and waits for an administrator to approve the profile. Approval is manual and is not automatic. An approved provider can still be unverified.',
  },
  {
    question: 'Are verification badges a guarantee?',
    answer:
      'No. “ID checked” or “Business verified” means an administrator reviewed a verification request. It is evidence that a check happened, not a guarantee of workmanship, pricing, or future behavior.',
  },
  {
    question: 'Can a review be removed?',
    answer:
      'Yes. An administrator can hide a review that breaks the rules, with a moderation reason recorded in the audit log. Reports about providers or reviews also enter a moderation queue — reporting does not automatically remove content.',
  },
  {
    question: 'Who can see my contact details?',
    answer:
      'Your email is hidden from providers until you accept their quote. Public reviews show a shortened customer name, not your full name. Do not put home addresses, ID numbers, or payment details in a request description.',
  },
  {
    question: 'Is email delivery configured?',
    answer:
      'Only if the deployment has an email provider configured. In local development, verification and password-reset links are generated and displayed on screen instead of being emailed. A verified email is separate from provider identity verification.',
  },
];

export function HowItWorksPage() {
  useDocumentTitle('How it works');
  return (
    <div className="page-shell py-10 sm:py-14">
      <PageHeader
        eyebrow="How AyosDito works"
        title="From a broken thing to an agreed fix."
        description="AyosDito is a local services marketplace, not a payment platform or a guarantee service. Here is exactly what happens, what each status means, and where responsibility sits."
        actions={
          <>
            <Link to="/providers" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              Find a provider
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/become-a-provider" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
              For providers
            </Link>
          </>
        }
      />

      <section className="mt-10" aria-labelledby="customer-flow">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">For customers</p>
            <h2 id="customer-flow" className="mt-1.5 text-2xl font-extrabold tracking-tight">
              Four steps, no mystery
            </h2>
          </div>
          <p className="hidden max-w-sm text-xs leading-relaxed text-ink-mute sm:block">
            Every action happens inside a protected account. Customers, providers, and administrators
            have separate permissions enforced by the server.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CUSTOMER_STEPS.map((step, index) => (
            <div key={step.title} className="card-surface flex flex-col p-5">
              <div className="flex items-center justify-between">
                <IconTile icon={step.icon} />
                <span className="font-display text-2xl font-extrabold text-brand-100" aria-hidden="true">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 overflow-hidden rounded-3xl border border-line bg-paper-soft shadow-card">
        <div className="border-b border-line bg-paper px-5 py-5 sm:px-7">
          <h2 className="text-lg font-bold">Statuses, in plain language</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-mute">
            The same status is shown to the customer and the provider. Status changes are validated by
            the API, so a job cannot jump straight from “waiting for quotes” to “completed.”
          </p>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="bg-paper-soft p-5">
              <RequestStatusBadge status={status} />
              <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">{STATUS_EXPLANATIONS[status]}</p>
            </div>
          ))}
          <div className="bg-brand-950 p-5 text-brand-100">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sun">Good to know</p>
            <p className="mt-2 text-xs leading-relaxed text-brand-100/80">
              A customer can cancel while a request is pending, has quotes, or is accepted. After work
              starts, cancellation is no longer available through the app.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card-surface p-6">
          <div className="flex items-center gap-2.5">
            <IconTile icon={MessageSquareQuote} size="sm" />
            <h2 className="text-lg font-bold">What a quote can include</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              A proposed price in Philippine pesos, shown as an estimate unless the provider marks it
              fixed.
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              Free-text notes about parts, scope, or assumptions.
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              An estimated duration such as “1–2 hours” or “same day.”
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              Provider verification badges and review summary, when those exist.
            </li>
          </ul>
          <p className="mt-4 rounded-xl bg-paper-deep/70 px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
            A provider can update a quote while it is still awaiting your decision. Once you accept one
            quote, all other pending quotes for that request are declined.
          </p>
        </section>

        <section className="card-surface p-6">
          <div className="flex items-center gap-2.5">
            <IconTile icon={LockKeyhole} size="sm" />
            <h2 className="text-lg font-bold">Privacy by default</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              Providers see the request details they need to quote, not the customer’s email.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              The customer’s email unlocks only for the provider whose quote is accepted.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              Public reviews use a shortened name, and moderation can hide abusive content.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              Passwords are stored as bcrypt hashes, and sign-in sessions are kept in HTTP-only cookies.
            </li>
          </ul>
          <p className="mt-4 rounded-xl bg-sun-soft/60 px-3.5 py-3 text-xs leading-relaxed text-sun-deep">
            Please don’t include home addresses, ID numbers, or payment details in a request or review.
            The MVP does not need them to match you with a provider.
          </p>
        </section>
      </div>

      <section id="trust" className="mt-12 scroll-mt-24" aria-labelledby="trust-heading">
        <div className="max-w-3xl">
          <p className="eyebrow">Trust &amp; honesty</p>
          <h2 id="trust-heading" className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
            What our badges, reviews, and demo labels actually mean
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Trust signals are only useful if they are precise. These are the rules the application
            enforces — not marketing claims.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card-surface p-5">
            <div className="flex items-center gap-2">
              <ShieldQuestion className="h-5 w-5 text-ink-mute" aria-hidden="true" />
              <h3 className="text-sm font-bold">Registered provider</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              The account exists and an administrator approved the profile. No identity or business
              verification has necessarily happened. A provider account never becomes “verified”
              automatically.
            </p>
            <p className="mt-3 inline-flex rounded-full border border-line px-2 py-1 text-[10px] font-semibold text-ink-mute">
              Badge: Not yet verified
            </p>
          </div>
          <div className="card-surface p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-sky-deep" aria-hidden="true" />
              <h3 className="text-sm font-bold">ID checked</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              An administrator approved an identity verification request. Submitted notes or evidence
              are not shown on the public profile, and the badge does not vouch for work quality.
            </p>
            <p className="mt-3 inline-flex rounded-full border border-[#cfe0eb] bg-sky-soft px-2 py-1 text-[10px] font-semibold text-sky-deep">
              Badge: ID checked
            </p>
          </div>
          <div className="card-surface border-brand-200 bg-brand-50/50 p-5">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-brand-700" aria-hidden="true" />
              <h3 className="text-sm font-bold">Business verified</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              An administrator reviewed business details supplied by the provider. It is a stronger
              signal than an unchecked profile, but still not a warranty for every job, price, or
              schedule.
            </p>
            <p className="mt-3 inline-flex rounded-full border border-brand-100 bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-800">
              Badge: Business verified
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-paper-soft p-4">
            <Star className="h-4 w-4 text-brand-700" aria-hidden="true" />
            <h3 className="mt-2 text-sm font-bold">Reviews reflect completed jobs</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              The review endpoint checks that the request belongs to the customer, is completed, and has
              no existing review.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper-soft p-4">
            <FileCheck2 className="h-4 w-4 text-brand-700" aria-hidden="true" />
            <h3 className="mt-2 text-sm font-bold">Ratings need real reviews</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              A provider with no visible reviews is shown as “No reviews yet.” Rating filters only
              include providers with at least three reviews.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper-soft p-4">
            <Flag className="h-4 w-4 text-brand-700" aria-hidden="true" />
            <h3 className="mt-2 text-sm font-bold">Reports are reviewed</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Reports enter an administrator queue. Resolution and account actions are written to an
              audit log.
            </p>
          </div>
          <div className="rounded-xl border border-sun/40 bg-sun-soft/60 p-4">
            <Wrench className="h-4 w-4 text-sun-deep" aria-hidden="true" />
            <h3 className="mt-2 text-sm font-bold">Demo data is labeled</h3>
            <p className="mt-1 text-xs leading-relaxed text-sun-deep">
              Sample providers and reviews from the development seed appear with a “Demo record” badge.
              They are fictional and must not be presented as real customer proof.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="provider-rules">
        <div className="grid gap-6 rounded-3xl bg-brand-900 p-6 text-brand-100 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sun">For providers</p>
            <h2 id="provider-rules" className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">
              Approval and verification are two separate checks.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-100/80">
              Approval lets an approved profile appear in the directory. Identity or business
              verification adds a badge only after a separate administrator review. Providers are
              responsible for accurate listings, prices, and service areas. AyosDito does not guarantee
              job volume, ranking, or income.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link to="/become-a-provider" className={buttonStyles({ variant: 'sun', size: 'md' })}>
              How to join
            </Link>
            <Link
              to="/register?role=provider"
              className={buttonStyles({
                variant: 'ghost',
                size: 'md',
                className: 'border border-brand-700 text-brand-100 hover:bg-brand-800 hover:text-white',
              })}
            >
              Sign up as a provider
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-extrabold tracking-tight">
          Common questions
        </h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group card-surface px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-ink">
                {faq.question}
                <span className="text-lg font-normal text-brand-700 transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-ink-soft">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-line bg-paper-soft p-6 text-center">
        <h2 className="text-xl font-extrabold">Ready to get something fixed?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Browse by service or search the provider directory. You can compare quote details before
          choosing anyone.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/services" className={buttonStyles({ variant: 'primary', size: 'md' })}>
            Browse services
          </Link>
          <Link to="/providers" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            Find providers
          </Link>
        </div>
      </section>
    </div>
  );
}
