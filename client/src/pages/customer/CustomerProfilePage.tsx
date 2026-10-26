import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Mail, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthResponse } from '@shared/api-types';
import { api, fieldErrorsFrom, isApiClientError } from '@/lib/api';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { useLocations } from '@/hooks/catalog';
import { buildLocationOptions, groupLocationOptions } from '@/lib/locations';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { LoadingBlock } from '@/components/ui/Feedback';
import { DemoBadge } from '@/components/ui/Verification';
import { EmailVerificationNotice } from '@/components/dashboard/EmailVerificationNotice';

interface ProfileFormValues {
  fullName: string;
  preferredLocationId: string;
}

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(128, 'Keep it under 128 characters.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type PasswordFormValues = z.input<typeof passwordFormSchema>;

export function CustomerProfilePage() {
  useDocumentTitle('Profile & security');
  const { user, setUser } = useAuth();
  const locations = useLocations();
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  const locationGroups = useMemo(
    () => groupLocationOptions(buildLocationOptions(locations.data ?? [])),
    [locations.data],
  );

  const profileForm = useForm<ProfileFormValues>({
    defaultValues: {
      fullName: user?.fullName ?? '',
      preferredLocationId: user?.preferredLocationId ?? '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  if (!user) return null;

  async function saveProfile(values: ProfileFormValues) {
    setSavingProfile(true);
    setProfileError(null);
    if (values.fullName.trim().length < 2) {
      profileForm.setError('fullName', { message: 'Enter your full name.' });
      setSavingProfile(false);
      return;
    }
    try {
      const result = await api.patch<AuthResponse>('/customer/me', {
        fullName: values.fullName.trim(),
        preferredLocationId: values.preferredLocationId || null,
      });
      setUser(result.user);
      toast.success('Profile updated.');
      profileForm.reset({
        fullName: result.user.fullName,
        preferredLocationId: result.user.preferredLocationId ?? '',
      });
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(values: PasswordFormValues) {
    setPasswordNotice(null);
    try {
      await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordNotice('Password changed. Other sessions were signed out.');
      toast.success('Password changed.');
    } catch (error) {
      if (isApiClientError(error) && error.code === 'INVALID_PASSWORD') {
        passwordForm.setError('currentPassword', { message: 'Your current password is incorrect.' });
        return;
      }
      const mapped = fieldErrorsFrom(error);
      if (mapped) {
        for (const [field, message] of Object.entries(mapped)) {
          if (field in passwordForm.getValues()) {
            passwordForm.setError(field as keyof PasswordFormValues, { message });
          }
        }
        return;
      }
      passwordForm.setError('root', {
        message: error instanceof Error ? error.message : 'Could not change your password.',
      });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Profile & security"
        title="Your customer account"
        description="Update how providers see your name and choose a default location for new requests. Your email is only shared with a provider after you accept their quote."
      />

      <EmailVerificationNotice />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="card-surface p-5 sm:p-6" aria-labelledby="profile-details-heading">
            <h2 id="profile-details-heading" className="flex items-center gap-2 text-base font-extrabold">
              <UserRound className="h-4 w-4 text-brand-700" aria-hidden="true" />
              Profile details
            </h2>
            <p className="mt-1 text-xs text-ink-mute">
              Your full name is shown to a provider after you accept their quote. Providers who only
              quote you see a shortened name.
            </p>

            <form onSubmit={profileForm.handleSubmit(saveProfile)} className="mt-5 space-y-4" noValidate>
              {profileError ? <Alert tone="error">{profileError}</Alert> : null}
              <Field
                id="profile-full-name"
                label="Full name"
                required
                error={profileForm.formState.errors.fullName?.message}
              >
                <Input
                  id="profile-full-name"
                  autoComplete="name"
                  maxLength={80}
                  {...profileForm.register('fullName')}
                />
              </Field>

              <Field
                id="profile-location"
                label="Default location for requests"
                hint="Used as the starting point when you post a new request. You can change it per request."
                error={profileForm.formState.errors.preferredLocationId?.message}
              >
                {locations.isPending ? (
                  <div className="text-xs text-ink-mute">Loading locations…</div>
                ) : locations.isError ? (
                  <div className="text-xs text-clay">Locations could not be loaded.</div>
                ) : (
                  <Select id="profile-location" {...profileForm.register('preferredLocationId')}>
                    <option value="">No default location</option>
                    {locationGroups.map(([group, options]) => (
                      <optgroup key={group} label={group}>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                )}
              </Field>

              <div className="flex justify-end">
                <Button type="submit" loading={savingProfile}>
                  Save profile
                </Button>
              </div>
            </form>
          </section>

          <section className="card-surface p-5 sm:p-6" aria-labelledby="password-heading">
            <h2 id="password-heading" className="flex items-center gap-2 text-base font-extrabold">
              <KeyRound className="h-4 w-4 text-brand-700" aria-hidden="true" />
              Change password
            </h2>
            <p className="mt-1 text-xs text-ink-mute">
              Choose at least 8 characters with a letter and a number. Changing your password signs
              out your other sessions.
            </p>

            {passwordNotice ? (
              <Alert tone="success" className="mt-4">
                {passwordNotice}
              </Alert>
            ) : null}

            <form
              onSubmit={passwordForm.handleSubmit(changePassword)}
              className="mt-5 max-w-lg space-y-4"
              noValidate
            >
              {passwordForm.formState.errors.root?.message ? (
                <Alert tone="error">{passwordForm.formState.errors.root.message}</Alert>
              ) : null}
              <Field
                id="current-password"
                label="Current password"
                required
                error={passwordForm.formState.errors.currentPassword?.message}
              >
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                />
              </Field>
              <Field
                id="new-password"
                label="New password"
                required
                error={passwordForm.formState.errors.newPassword?.message}
                hint="At least 8 characters, including a letter and a number."
              >
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                />
              </Field>
              <Field
                id="confirm-password"
                label="Confirm new password"
                required
                error={passwordForm.formState.errors.confirmPassword?.message}
              >
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary" loading={passwordForm.formState.isSubmitting}>
                  Update password
                </Button>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card-surface p-5">
            <h2 className="text-sm font-extrabold">Account</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
                </dt>
                <dd className="mt-0.5 break-all font-medium">{user.email}</dd>
                <dd className="mt-1">
                  {user.emailVerified ? (
                    <Badge variant="brand">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="danger">Not verified</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Role</dt>
                <dd className="mt-0.5 font-medium capitalize">{user.role.toLowerCase()}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
                  Member since
                </dt>
                <dd className="mt-0.5 font-medium">{formatDate(user.createdAt)}</dd>
              </div>
              {user.preferredLocationId ? (
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Default area
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {locations.data?.find((location) => location.id === user.preferredLocationId)?.name ??
                      'Saved location'}
                  </dd>
                </div>
              ) : null}
            </dl>
            {user.isDemo ? (
              <div className="mt-4">
                <DemoBadge label="Demo account" />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
            <p className="font-bold text-ink">What we store</p>
            <p className="mt-2">
              We store your name, email, password hash, session records, requests, quotes, reviews,
              and optional default area. Do not send identity documents through request descriptions
              or review comments.
            </p>
            <Link to="/privacy" className="mt-2 inline-block font-semibold text-brand-800 underline underline-offset-2">
              Read the draft privacy notice
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
