import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, BriefcaseBusiness, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import {
  emailSchema,
  fullNameSchema,
  passwordSchema,
} from '@shared/contracts';
import type { RegistrationResponse } from '@shared/api-types';
import { api, fieldErrorsFrom } from '@/lib/api';
import { dashboardPath, safeNextPath } from '@/lib/format';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { AuthShell } from '@/components/layout/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';

const registerFormSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
    role: z.enum(['CUSTOMER', 'PROVIDER']),
    businessName: z.string().trim().max(80, 'Keep the display name under 80 characters.').optional(),
    acceptTerms: z.boolean().refine((value) => value, 'Accept the terms and privacy notice to continue.'),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
    if (value.role === 'PROVIDER' && !value.businessName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['businessName'],
        message: 'Enter the name customers will see.',
      });
    }
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function RegisterPage() {
  useDocumentTitle('Create an account');
  const { user, isLoading, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const initialRole = params.get('role') === 'provider' ? 'PROVIDER' : 'CUSTOMER';
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegistrationResponse | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: initialRole,
      businessName: '',
      acceptTerms: false,
    },
  });

  const role = form.watch('role');

  useEffect(() => {
    form.setValue('role', initialRole);
  }, [initialRole, form]);

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      const result = await api.post<RegistrationResponse>('/auth/register', {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role: values.role,
        ...(values.role === 'PROVIDER' ? { businessName: values.businessName?.trim() } : {}),
      });
      setUser(result.user);
      setCreated(result);
      toast.success('Your account was created.');
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped) {
        for (const [field, message] of Object.entries(mapped)) {
          if (field in form.getValues()) {
            form.setError(field as keyof RegisterFormValues, { message });
          }
        }
      }
      setServerError(error instanceof Error ? error.message : 'Could not create your account. Try again.');
    }
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  if (created) {
    const isProvider = created.user.role === 'PROVIDER';
    return (
      <AuthShell
        title="Account created"
        subtitle={
          isProvider
            ? 'Your provider profile exists, but it is not public until an administrator approves it. Add your services and service areas next.'
            : 'Your customer account is ready. You can browse providers and send your first service request.'
        }
        footer={
          <Link to={loginHref} className="font-semibold text-brand-700 hover:underline">
            Go to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <Alert tone="success" title="Signed in automatically">
            {created.user.fullName}, you are signed in as a {created.user.role.toLowerCase()}. You can
            verify your email now or continue to your dashboard.
          </Alert>

          {!created.user.emailVerified ? (
            <div className="rounded-xl border border-line bg-paper-soft p-4">
              <div className="flex items-center gap-2">
                <MailCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
                <p className="text-sm font-bold">Verify your email address</p>
              </div>
              {created.devVerificationUrl ? (
                <>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                    Email delivery is not configured for this environment, so the development
                    verification link is shown here. It will not be displayed once the site runs in
                    production with email configured.
                  </p>
                  <a
                    href={created.devVerificationUrl}
                    className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'mt-3 break-all' })}
                  >
                    Open verification link
                  </a>
                </>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  Check your inbox for the verification link. If email delivery is not configured,
                  request a new link from your dashboard and the server logs will contain the
                  development URL.
                </p>
              )}
            </div>
          ) : null}

          {isProvider ? (
            <Alert tone="warning" title="Provider approval is required">
              Your profile is pending administrator review. It will not appear in the public directory
              until it is approved. You can build it now — add a photo, description, service areas, and
              at least one active service.
            </Alert>
          ) : null}

          <Button
            type="button"
            size="lg"
            fullWidth
            onClick={() => navigate(next ?? dashboardPath(created.user.role))}
          >
            {isProvider ? 'Set up your provider profile' : 'Go to my dashboard'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-ink-mute">
            Email verification and provider verification are different. Creating an account never
            grants a verification badge.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your AyosDito account"
      subtitle="Join as a customer looking for help, or as a local provider who wants a structured profile."
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginHref} className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {user && !isLoading ? (
        <Alert tone="info" className="mb-4">
          You are already signed in as {user.fullName}. Creating a new account will replace this
          session. You can also{' '}
          <Link to={dashboardPath(user.role)} className="font-semibold underline">
            go to your dashboard
          </Link>
          .
        </Alert>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}

        <fieldset>
          <legend className="field-label">Account type</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: 'CUSTOMER' as const,
                title: 'Customer',
                description: 'Request services',
                icon: UserRound,
              },
              {
                value: 'PROVIDER' as const,
                title: 'Provider',
                description: 'Offer services',
                icon: BriefcaseBusiness,
              },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 transition ${
                  role === option.value
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-600/15'
                    : 'border-line bg-white/70 hover:border-brand-200'
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  className="sr-only"
                  {...form.register('role')}
                />
                <option.icon
                  className={`h-5 w-5 ${role === option.value ? 'text-brand-700' : 'text-ink-mute'}`}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-bold">{option.title}</span>
                  <span className="block text-[11px] text-ink-mute">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field id="register-name" label="Full name" required error={form.formState.errors.fullName?.message}>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="Juan Dela Cruz"
            aria-invalid={Boolean(form.formState.errors.fullName)}
            {...form.register('fullName')}
          />
        </Field>

        <Field id="register-email" label="Email address" required error={form.formState.errors.email?.message}>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
        </Field>

        {role === 'PROVIDER' ? (
          <Field
            id="register-business"
            label="Business or display name"
            required
            error={form.formState.errors.businessName?.message}
            hint="This is what customers will see. You can use your own name if you work independently."
          >
            <Input
              id="register-business"
              autoComplete="organization"
              placeholder="e.g. Malolos Laptop Care"
              aria-invalid={Boolean(form.formState.errors.businessName)}
              {...form.register('businessName')}
            />
          </Field>
        ) : null}

        <Field
          id="register-password"
          label="Password"
          required
          error={form.formState.errors.password?.message}
          hint="At least 8 characters, including a letter and a number."
        >
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            placeholder="Create a password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>

        <Field
          id="register-confirm"
          label="Confirm password"
          required
          error={form.formState.errors.confirmPassword?.message}
        >
          <PasswordInput
            id="register-confirm"
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register('confirmPassword')}
          />
        </Field>

        <div>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 accent-brand-700"
              {...form.register('acceptTerms')}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="font-semibold text-brand-700 underline" target="_blank">
                terms of use
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-semibold text-brand-700 underline" target="_blank">
                privacy notice
              </Link>
              . I am at least 18 years old.
            </span>
          </label>
          {form.formState.errors.acceptTerms ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-clay">
              {form.formState.errors.acceptTerms.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Create account
        </Button>

        {role === 'PROVIDER' ? (
          <p className="text-center text-[11px] leading-relaxed text-ink-mute">
            New provider profiles start as pending. Public listing requires administrator approval.
          </p>
        ) : null}
      </form>
    </AuthShell>
  );
}
