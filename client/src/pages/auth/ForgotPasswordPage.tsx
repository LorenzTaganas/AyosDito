import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, Send } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@shared/contracts';
import type { ForgotPasswordResponse } from '@shared/api-types';
import { api, fieldErrorsFrom } from '@/lib/api';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    try {
      const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', values);
      setResult(response);
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped?.email) form.setError('email', { message: mapped.email });
      setServerError(error instanceof Error ? error.message : 'Could not request a reset link. Try again.');
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address on your AyosDito account. We will generate a reset link if an active account matches."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {result ? (
        <div className="space-y-4">
          <Alert tone="success" title="Check your email">
            {result.message}
          </Alert>
          {result.devResetUrl ? (
            <div className="rounded-xl border border-line bg-paper-soft p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <MailCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
                Development reset link
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                Email delivery is not configured in this environment, so the generated link is shown
                here. It expires after 30 minutes.
              </p>
              <a
                href={result.devResetUrl}
                className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'mt-3 break-all' })}
              >
                Open reset link
              </a>
            </div>
          ) : null}
          <p className="text-xs leading-relaxed text-ink-mute">
            For privacy, this page gives the same response whether or not an account exists. Reset
            links are single-use and expire after 30 minutes.
          </p>
          <Button type="button" variant="secondary" fullWidth onClick={() => setResult(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError ? <Alert tone="error">{serverError}</Alert> : null}
          <Field
            id="forgot-email"
            label="Email address"
            required
            error={form.formState.errors.email?.message}
            hint="Use the address you registered with."
          >
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register('email')}
            />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Send reset instructions
          </Button>
          <p className="text-[11px] leading-relaxed text-ink-mute">
            For security, this endpoint does not reveal whether a given email is registered.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
