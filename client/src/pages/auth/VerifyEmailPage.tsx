import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailCheck, TriangleAlert } from 'lucide-react';
import type { MessageResponse, ResendVerificationResponse } from '@shared/api-types';
import { api } from '@/lib/api';
import { dashboardPath } from '@/lib/format';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/ui/Feedback';

type VerifyState = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  useDocumentTitle('Verify email');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, refresh } = useAuth();
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState<string>(
    token ? '' : 'This page needs a verification token from the email link.',
  );
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [devVerificationUrl, setDevVerificationUrl] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    let active = true;
    api
      .post<MessageResponse>('/auth/verify-email', { token })
      .then(async (result) => {
        if (!active) return;
        setMessage(result.message);
        setState('success');
        await refresh();
      })
      .catch((error) => {
        if (!active) return;
        setState('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'This verification link could not be used. It may be expired or already used.',
        );
      });
    return () => {
      active = false;
    };
  }, [token, refresh]);

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    setDevVerificationUrl(null);
    try {
      const result = await api.post<ResendVerificationResponse>('/auth/resend-verification');
      setResendMessage(result.message);
      if (result.devVerificationUrl) setDevVerificationUrl(result.devVerificationUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate a new verification link.');
    } finally {
      setResending(false);
    }
  }

  const footer = user ? (
    <Link to={dashboardPath(user.role)} className="font-semibold text-brand-700 hover:underline">
      Back to your dashboard
    </Link>
  ) : (
    <Link to="/login" className="font-semibold text-brand-700 hover:underline">
      Back to sign in
    </Link>
  );

  return (
    <AuthShell
      title="Email verification"
      subtitle="Email verification confirms that the address belongs to you. It is separate from provider identity or business verification."
      footer={footer}
    >
      {state === 'verifying' ? (
        <LoadingBlock label="Verifying your email address…" />
      ) : state === 'success' ? (
        <div className="space-y-4">
          <Alert tone="success" title="Email verified">
            {message || 'Your email address has been verified.'}
          </Alert>
          {user ? (
            <Link to={dashboardPath(user.role)} className={buttonStyles({ variant: 'primary', size: 'lg', fullWidth: true })}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Continue to dashboard
            </Link>
          ) : (
            <Link to="/login" className={buttonStyles({ variant: 'primary', size: 'lg', fullWidth: true })}>
              Sign in to continue
            </Link>
          )}
          <p className="text-center text-[11px] leading-relaxed text-ink-mute">
            A verified email does not make a provider “verified.” Identity and business badges require
            a separate administrator review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert tone="error" title="Verification did not complete">
            {message}
          </Alert>
          {user && !user.emailVerified ? (
            <div className="rounded-xl border border-line bg-paper-soft p-4">
              <div className="flex items-center gap-2">
                <MailCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
                <p className="text-sm font-bold">Generate a new link</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                You are signed in as {user.email}. Request a fresh verification link for this account.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                loading={resending}
                onClick={handleResend}
              >
                {resending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Generating…
                  </>
                ) : (
                  'Resend verification link'
                )}
              </Button>
              {resendMessage ? <Alert tone="info" className="mt-3">{resendMessage}</Alert> : null}
              {devVerificationUrl ? (
                <a
                  href={devVerificationUrl}
                  className="mt-3 block break-all text-xs font-semibold text-brand-700 underline"
                >
                  Open the new development verification link
                </a>
              ) : null}
            </div>
          ) : !user ? (
            <div className="rounded-xl border border-line bg-paper-soft p-4 text-xs leading-relaxed text-ink-soft">
              Sign in first if you need to generate a new verification link. If you cannot access the
              account email, ask the site operator for help; support for account recovery is not
              automated in this MVP.
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 p-4 text-xs leading-relaxed text-brand-900">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Your email is already verified on this account, so no new link is needed.
            </div>
          )}
          <Link to="/forgot-password" className={buttonStyles({ variant: 'ghost', size: 'sm', fullWidth: true })}>
            Having trouble signing in?
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
