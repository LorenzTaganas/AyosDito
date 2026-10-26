import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import { loginSchema, type LoginInput } from '@shared/contracts';
import { fieldErrorsFrom } from '@/lib/api';
import { dashboardPath, safeNextPath } from '@/lib/format';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { LoadingBlock } from '@/components/ui/Feedback';

export function LoginPage() {
  useDocumentTitle('Log in');
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!isLoading && user) {
      navigate(next ?? dashboardPath(user.role), { replace: true });
    }
  }, [isLoading, user, next, navigate]);

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const signedIn = await login(values);
      toast.success(`Welcome back, ${signedIn.fullName.split(' ')[0]}.`);
      navigate(next ?? dashboardPath(signedIn.role), { replace: true });
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped?.email) form.setError('email', { message: mapped.email });
      if (mapped?.password) form.setError('password', { message: mapped.password });
      setServerError(error instanceof Error ? error.message : 'Could not sign in. Please try again.');
    }
  }

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register';

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage requests, compare quotes, or update your provider profile."
      footer={
        <>
          New to AyosDito?{' '}
          <Link to={registerHref} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Checking your session…" />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError ? <Alert tone="error">{serverError}</Alert> : null}

          <Field
            id="login-email"
            label="Email address"
            required
            error={form.formState.errors.email?.message}
          >
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register('email')}
            />
          </Field>

          <Field
            id="login-password"
            label="Password"
            required
            error={form.formState.errors.password?.message}
          >
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              placeholder="Your password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register('password')}
            />
          </Field>

          <div className="flex items-center justify-between">
            <Link to="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">
              Forgot your password?
            </Link>
            <span className="text-[11px] text-ink-mute">Cookies required to sign in</span>
          </div>

          <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in
          </Button>

          <p className="text-center text-[11px] leading-relaxed text-ink-mute">
            AyosDito uses an HTTP-only session cookie and checks your role on the server for every
            protected action.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
