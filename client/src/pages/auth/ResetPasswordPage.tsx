import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { passwordSchema } from '@shared/contracts';
import type { MessageResponse } from '@shared/api-types';
import { api, fieldErrorsFrom } from '@/lib/api';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';

const resetFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type ResetFormValues = z.infer<typeof resetFormSchema>;

export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { setUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: ResetFormValues) {
    setServerError(null);
    try {
      await api.post<MessageResponse>('/auth/reset-password', {
        token,
        password: values.password,
      });
      setUser(null);
      setCompleted(true);
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped?.password) form.setError('password', { message: mapped.password });
      setServerError(
        error instanceof Error
          ? error.message
          : 'The reset link could not be used. Request a new link and try again.',
      );
    }
  }

  const footer = (
    <>
      Need a new link?{' '}
      <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">
        Request another reset
      </Link>
    </>
  );

  if (!token) {
    return (
      <AuthShell
        title="Reset link missing"
        subtitle="This page needs a valid token from a password-reset link."
        footer={footer}
      >
        <Alert tone="error" title="No reset token found">
          Open the complete link from your reset email or development console. Reset links expire
          after 30 minutes and can only be used once.
        </Alert>
        <Link to="/forgot-password" className={buttonStyles({ variant: 'primary', size: 'lg', fullWidth: true, className: 'mt-4' })}>
          Request a new reset link
        </Link>
      </AuthShell>
    );
  }

  if (completed) {
    return (
      <AuthShell
        title="Password updated"
        subtitle="Your previous sessions were revoked. Sign in again with your new password."
        footer={footer}
      >
        <div className="space-y-4">
          <Alert tone="success" title="All set">
            Your password has been changed. For your security, every other active session was signed
            out.
          </Alert>
          <Link to="/login" className={buttonStyles({ variant: 'primary', size: 'lg', fullWidth: true })}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Continue to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use at least 8 characters with a letter and a number. This link can only be used once."
      footer={footer}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}
        <Field
          id="reset-password"
          label="New password"
          required
          error={form.formState.errors.password?.message}
          hint="Avoid reusing a password from another site."
        >
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            placeholder="New password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>
        <Field
          id="reset-confirm"
          label="Confirm new password"
          required
          error={form.formState.errors.confirmPassword?.message}
        >
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            placeholder="Repeat the new password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register('confirmPassword')}
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Update password
        </Button>
        <p className="text-[11px] leading-relaxed text-ink-mute">
          Updating your password revokes other active sessions stored by the server.
        </p>
      </form>
    </AuthShell>
  );
}
