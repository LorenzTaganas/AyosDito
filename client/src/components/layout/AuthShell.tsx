import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { Logo } from '@/components/ui/Brand';
import { buttonStyles } from '@/components/ui/Button';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="grid min-h-dvh lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden bg-brand-800 px-10 py-12 text-paper-soft lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="dot-grid absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative">
            <Logo inverted />
            <div className="mt-20 max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Local services, made simple</p>
              <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.1] text-white">
                May sira?
                <br />
                May maaasahang aayos!
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-brand-100/80">
                Compare local service providers, request clear quotations, and keep every job
                decision in one place.
              </p>
            </div>
          </div>
          <ul className="relative space-y-4 text-sm text-brand-100/85">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" aria-hidden="true" />
              <span>Verification badges appear only after an administrator reviews the submitted details.</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" aria-hidden="true" />
              <span>Reviews open only after a provider marks the job complete.</span>
            </li>
            <li className="flex gap-3">
              <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" aria-hidden="true" />
              <span>Demo accounts and sample records are clearly labeled.</span>
            </li>
          </ul>
        </aside>
        <div className="flex flex-col px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex items-center justify-between">
            <div className="lg:hidden">
              <Logo />
            </div>
            <Link
              to="/"
              className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'ml-auto' })}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to AyosDito
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[26rem]">
              <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{subtitle}</p>
              <div className="mt-7">{children}</div>
              {footer ? <div className="mt-6 text-center text-sm text-ink-mute">{footer}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
