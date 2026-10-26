import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  ImagePlus,
  MapPin,
  ShieldAlert,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderSelf } from '@shared/api-types';
import { MAX_UPLOAD_MB } from '@shared/contracts';
import { api, fieldErrorsFrom } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { useLocations } from '@/hooks/catalog';
import { buildLocationOptions, groupLocationOptions } from '@/lib/locations';
import { PageHeader } from '@/components/ui/Brand';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock, Spinner } from '@/components/ui/Feedback';
import { DemoBadge } from '@/components/ui/Verification';
import { EmailVerificationNotice } from '@/components/dashboard/EmailVerificationNotice';

interface ProfileFormValues {
  businessName: string;
  description: string;
  yearsOfExperience: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function acceptImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Choose a JPEG, PNG, or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return `Choose an image smaller than ${MAX_UPLOAD_MB} MB.`;
  return null;
}

export function ProviderProfileSettingsPage() {
  useDocumentTitle('Profile & portfolio');
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const locations = useLocations();
  const self = useQuery({
    queryKey: queryKeys.providerSelf,
    queryFn: () => api.get<ProviderSelf>('/providers/me'),
  });

  const provider = self.data;

  const profileForm = useForm<ProfileFormValues>({
    values: provider
      ? {
          businessName: provider.businessName,
          description: provider.description,
          yearsOfExperience:
            provider.yearsOfExperience === null ? '' : String(provider.yearsOfExperience),
        }
      : undefined,
    defaultValues: { businessName: '', description: '', yearsOfExperience: '' },
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState('');
  const [savingAreas, setSavingAreas] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const portfolioInput = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioCaption, setPortfolioCaption] = useState('');
  const [pendingDeleteImage, setPendingDeleteImage] = useState<{ id: string; caption: string | null } | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!provider) return;
    setSelectedAreas(provider.serviceAreas.map((area) => area.id));
  }, [provider?.id]);

  const locationGroups = groupLocationOptions(buildLocationOptions(locations.data ?? []));
  const areaLabels = new Map(
    (locations.data ?? []).map((location) => [
      location.id,
      location.parentName ? `${location.name}, ${location.parentName}` : location.name,
    ]),
  );

  function applySelf(next: ProviderSelf) {
    queryClient.setQueryData(queryKeys.providerSelf, next);
    void queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard });
    void queryClient.invalidateQueries({ queryKey: ['providers', 'search'] });
  }

  async function saveProfile(values: ProfileFormValues) {
    profileForm.clearErrors();
    setProfileError(null);

    const businessName = values.businessName.trim();
    const description = values.description.trim();
    const yearsRaw = values.yearsOfExperience.trim();
    let invalid = false;

    if (businessName.length < 2) {
      profileForm.setError('businessName', { message: 'Enter your business or display name.' });
      invalid = true;
    }
    if (description.length > 2000) {
      profileForm.setError('description', { message: 'Keep the description under 2,000 characters.' });
      invalid = true;
    }

    let years: number | null = null;
    if (yearsRaw !== '') {
      const parsed = Number(yearsRaw);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 80) {
        profileForm.setError('yearsOfExperience', {
          message: 'Enter a whole number between 0 and 80, or leave it blank.',
        });
        invalid = true;
      } else {
        years = parsed;
      }
    }
    if (invalid) return;

    setSavingProfile(true);
    try {
      const updated = await api.patch<ProviderSelf>('/providers/me', {
        businessName,
        description,
        yearsOfExperience: years,
      });
      applySelf(updated);
      profileForm.reset({
        businessName: updated.businessName,
        description: updated.description,
        yearsOfExperience:
          updated.yearsOfExperience === null ? '' : String(updated.yearsOfExperience),
      });
      await refresh();
      toast.success(
        updated.approvalStatus === 'PENDING' && provider?.approvalStatus === 'REJECTED'
          ? 'Profile saved. Your application is back under review.'
          : 'Profile saved.',
      );
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped) {
        for (const [field, message] of Object.entries(mapped)) {
          if (field in profileForm.getValues()) {
            profileForm.setError(field as keyof ProfileFormValues, { message });
          }
        }
      } else {
        setProfileError(error instanceof Error ? error.message : 'Could not save your profile.');
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveServiceAreas() {
    setSavingAreas(true);
    setUploadError(null);
    try {
      const updated = await api.put<ProviderSelf>('/providers/me/service-areas', {
        locationIds: selectedAreas,
      });
      applySelf(updated);
      setSelectedAreas(updated.serviceAreas.map((area) => area.id));
      await queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard });
      toast.success('Service areas saved.');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not save your service areas.');
    } finally {
      setSavingAreas(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploadError(null);
    const problem = acceptImage(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const updated = await api.upload<ProviderSelf>('/providers/me/avatar', formData);
      applySelf(updated);
      await refresh();
      toast.success('Profile photo updated.');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not upload the photo.');
    } finally {
      setAvatarUploading(false);
      if (avatarInput.current) avatarInput.current.value = '';
    }
  }

  async function uploadPortfolio(file: File) {
    setUploadError(null);
    const problem = acceptImage(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setPortfolioUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (portfolioCaption.trim()) formData.append('caption', portfolioCaption.trim());
      const updated = await api.upload<ProviderSelf>('/providers/me/portfolio', formData);
      applySelf(updated);
      setPortfolioCaption('');
      toast.success('Portfolio image added.');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not upload the image.');
    } finally {
      setPortfolioUploading(false);
      if (portfolioInput.current) portfolioInput.current.value = '';
    }
  }

  async function deletePortfolioImage() {
    if (!pendingDeleteImage) return;
    setDeletingImage(true);
    setUploadError(null);
    try {
      const updated = await api.delete<ProviderSelf>(`/providers/me/portfolio/${pendingDeleteImage.id}`);
      applySelf(updated);
      toast.success('Portfolio image removed.');
      setPendingDeleteImage(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not remove the image.');
    } finally {
      setDeletingImage(false);
    }
  }

  if (self.isPending) {
    return <LoadingBlock label="Loading your provider profile…" />;
  }

  if (self.isError || !provider) {
    return (
      <ErrorState
        message="We could not load your provider profile. Check your connection and try again."
        onRetry={() => self.refetch()}
      />
    );
  }

  const filteredGroups = locationGroups
    .map(([group, options]) => {
      const needle = areaFilter.trim().toLowerCase();
      const filtered = needle
        ? options.filter((option) => option.label.toLowerCase().includes(needle))
        : options;
      return [group, filtered] as const;
    })
    .filter(([, options]) => options.length > 0);

  const approvalLabel =
    provider.approvalStatus === 'APPROVED'
      ? 'Approved provider'
      : provider.approvalStatus === 'REJECTED'
        ? 'Changes needed'
        : 'Under review';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Profile & portfolio"
        title="How customers see your business"
        description="Keep your business name, description, service areas, and photos accurate. Your public page only shows approved profiles with active services."
        actions={
          provider.approvalStatus === 'APPROVED' ? (
            <Link
              to={`/providers/${provider.id}`}
              className={buttonStyles({ variant: 'secondary', size: 'md' })}
            >
              View public profile
            </Link>
          ) : undefined
        }
      />

      <EmailVerificationNotice />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-soft px-4 py-3 text-xs text-ink-soft">
        <Badge
          variant={
            provider.approvalStatus === 'APPROVED'
              ? 'brand'
              : provider.approvalStatus === 'REJECTED'
                ? 'danger'
                : 'sun'
          }
        >
          {approvalLabel}
        </Badge>
        {provider.isDemo ? <DemoBadge label="Demo provider" /> : null}
        <span>
          Approval and verification are separate. An approval means an administrator checked that
          this profile can be listed; verification badges require a specific review.
        </span>
      </div>

      {provider.approvalStatus === 'REJECTED' ? (
        <Alert tone="error" title="Your application was returned for changes">
          <p>
            {provider.rejectionReason ??
              'An administrator asked for changes to this profile. Review the details and save the form to resubmit.'}
          </p>
          <p className="mt-2">Saving this form resets your application status to “under review.”</p>
        </Alert>
      ) : provider.approvalStatus === 'PENDING' ? (
        <Alert tone="warning" title="Your profile is not publicly listed yet">
          You can edit everything on this page. An administrator must approve your profile before it
          appears in the directory and before you receive open requests.
        </Alert>
      ) : null}

      {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="card-surface p-5 sm:p-6" aria-labelledby="provider-details-heading">
            <h2 id="provider-details-heading" className="flex items-center gap-2 text-base font-extrabold">
              <UserRound className="h-4 w-4 text-brand-700" aria-hidden="true" />
              Business details
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute">
              Customers compare your description with the actual scope of work. Avoid promises you
              cannot keep and do not include private contact details here.
            </p>

            <form onSubmit={profileForm.handleSubmit(saveProfile)} className="mt-5 space-y-4" noValidate>
              {profileError ? <Alert tone="error">{profileError}</Alert> : null}
              <Field
                id="provider-business-name"
                label="Business or display name"
                required
                error={profileForm.formState.errors.businessName?.message}
              >
                <Input
                  id="provider-business-name"
                  maxLength={80}
                  autoComplete="organization"
                  {...profileForm.register('businessName')}
                />
              </Field>

              <Field
                id="provider-description"
                label="Short description"
                hint="At least 40 characters is recommended: what you fix, how you work, and anything customers should prepare."
                error={profileForm.formState.errors.description?.message}
              >
                <Textarea
                  id="provider-description"
                  rows={6}
                  maxLength={2000}
                  placeholder="Example: A two-person laptop repair shop in Malolos. We explain the diagnosis before replacing parts and return the original components to the customer."
                  {...profileForm.register('description')}
                />
              </Field>

              <Field
                id="provider-years"
                label="Years of experience"
                hint="Optional. Only enter a real, verifiable number. This is self-reported and is not a verification badge."
                error={profileForm.formState.errors.yearsOfExperience?.message}
              >
                <Input
                  id="provider-years"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={80}
                  step={1}
                  placeholder="e.g. 3"
                  {...profileForm.register('yearsOfExperience')}
                />
              </Field>

              <div className="flex justify-end">
                <Button type="submit" loading={savingProfile}>
                  Save business details
                </Button>
              </div>
            </form>
          </section>

          <section className="card-surface p-5 sm:p-6" aria-labelledby="service-areas-heading">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="service-areas-heading" className="flex items-center gap-2 text-base font-extrabold">
                  <MapPin className="h-4 w-4 text-brand-700" aria-hidden="true" />
                  Service areas
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                  Choose the places you can realistically visit. Selecting a city also covers its
                  barangays for matching. You can select up to 30 areas.
                </p>
              </div>
              <Badge variant={selectedAreas.length > 0 ? 'brand' : 'outline'}>
                {selectedAreas.length} selected
              </Badge>
            </div>

            {locations.isPending ? (
              <p className="mt-4 text-xs text-ink-mute">Loading locations…</p>
            ) : locations.isError ? (
              <p className="mt-4 text-xs text-clay">
                Locations could not be loaded. You can still save business details and try again
                later.
              </p>
            ) : (
              <>
                <div className="mt-4">
                  <Input
                    aria-label="Filter service areas"
                    placeholder="Filter by barangay, city, or province"
                    value={areaFilter}
                    onChange={(event) => setAreaFilter(event.target.value)}
                  />
                </div>
                <div className="mt-3 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-line bg-white/60 p-3">
                  {filteredGroups.map(([group, options]) => (
                    <fieldset key={group}>
                      <legend className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">
                        {group}
                      </legend>
                      <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                        {options.map((option) => {
                          const checked = selectedAreas.includes(option.id);
                          return (
                            <label
                              key={option.id}
                              className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-ink-soft hover:bg-paper"
                            >
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-line text-brand-700 focus:ring-brand-600"
                                checked={checked}
                                disabled={!checked && selectedAreas.length >= 30}
                                onChange={() => {
                                  setSelectedAreas((current) =>
                                    current.includes(option.id)
                                      ? current.filter((id) => id !== option.id)
                                      : [...current, option.id],
                                  );
                                }}
                              />
                              {option.label}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                  {filteredGroups.length === 0 ? (
                    <p className="text-xs text-ink-mute">No locations match that filter.</p>
                  ) : null}
                </div>

                {selectedAreas.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedAreas.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedAreas((current) => current.filter((areaId) => areaId !== id))}
                        className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800"
                        aria-label={`Remove ${areaLabels.get(id) ?? 'service area'}`}
                      >
                        {areaLabels.get(id) ?? 'Selected area'}
                        <span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-clay">
                    Without a service area, your profile will not match open requests.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAreas([])}
                    disabled={selectedAreas.length === 0}
                  >
                    Clear all
                  </Button>
                  <Button type="button" onClick={saveServiceAreas} loading={savingAreas}>
                    Save service areas
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className="card-surface p-5 sm:p-6" aria-labelledby="portfolio-heading">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="portfolio-heading" className="text-base font-extrabold">
                  Portfolio
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                  Show real work you completed. Up to 12 images. A portfolio is presentation, not a
                  verification or a guarantee.
                </p>
              </div>
              <Badge variant="outline">{provider.portfolioImages.length} / 12</Badge>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-line bg-paper/60 p-4">
              <label htmlFor="portfolio-caption" className="field-label">
                Caption <span className="font-normal text-ink-mute">(optional, max 140 characters)</span>
              </label>
              <Input
                id="portfolio-caption"
                maxLength={140}
                value={portfolioCaption}
                onChange={(event) => setPortfolioCaption(event.target.value)}
                placeholder="Example: Laptop fan and thermal paste replacement"
                className="mt-1.5"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={portfolioInput}
                  id="portfolio-file"
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPortfolio(file);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={portfolioUploading}
                  disabled={provider.portfolioImages.length >= 12}
                  onClick={() => portfolioInput.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  Add image
                </Button>
                <span className="text-[11px] text-ink-mute">
                  JPEG, PNG, or WebP · up to {MAX_UPLOAD_MB} MB
                </span>
              </div>
            </div>

            {provider.portfolioImages.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={<ImagePlus className="h-5 w-5" aria-hidden="true" />}
                title="No portfolio images yet"
                description="Add photos of past repair work that you have permission to share. Do not upload customer identity documents or photos that show private information."
              />
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {provider.portfolioImages.map((image) => (
                  <li key={image.id} className="overflow-hidden rounded-xl border border-line bg-paper-soft">
                    <img
                      src={image.imageUrl}
                      alt={image.caption ?? 'Portfolio work sample'}
                      className="aspect-[4/3] w-full object-cover"
                      loading="lazy"
                    />
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {image.caption ?? 'No caption'}
                        </p>
                        <p className="text-[10px] text-ink-mute">Added {new Date(image.createdAt).toLocaleDateString('en-PH')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDeleteImage({ id: image.id, caption: image.caption })
                        }
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-mute hover:border-clay/30 hover:text-clay"
                        aria-label={`Remove ${image.caption ?? 'portfolio image'}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card-surface p-5">
            <h2 className="text-sm font-extrabold">Profile photo</h2>
            <div className="mt-3 flex items-center gap-4">
              <Avatar
                name={provider.businessName}
                imageUrl={provider.profileImage}
                size="xl"
              />
              <div className="flex-1">
                <input
                  ref={avatarInput}
                  id="avatar-file"
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={avatarUploading}
                  onClick={() => avatarInput.current?.click()}
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Upload photo
                </Button>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                  A clear logo or work-space photo works best. JPEG, PNG, or WebP up to{' '}
                  {MAX_UPLOAD_MB} MB.
                </p>
              </div>
            </div>
            {avatarUploading ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-mute">
                <Spinner className="h-3.5 w-3.5" /> Uploading…
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-clay/20 bg-clay-soft/40 p-4 text-xs leading-relaxed text-[#8f2f1d]">
            <p className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Do not upload identity documents
            </p>
            <p className="mt-2">
              Profile photos and portfolio images are stored in a publicly accessible uploads
              folder. Never upload a driver&apos;s license, passport, barangay certificate, or other
              private document here. Verification requests on this MVP do not accept document
              uploads either.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
            <p className="flex items-center gap-1.5 font-bold text-ink">
              <AlertTriangle className="h-3.5 w-3.5 text-sun-deep" aria-hidden="true" />
              Keep it accurate
            </p>
            <p className="mt-2">
              Do not invent years of experience, certifications, or completed jobs. Describe what
              you can actually do. Reputation signals on AyosDito come from real completed requests
              and reviews, not from claims on this page.
            </p>
            {user?.isDemo ? <p className="mt-2">This demo account is seeded sample data.</p> : null}
          </div>
        </aside>
      </div>

      <Dialog
        open={pendingDeleteImage !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteImage(null);
        }}
        title="Remove this portfolio image?"
        description="The image file will be deleted from the server. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDeleteImage(null)}>
              Keep image
            </Button>
            <Button variant="danger" loading={deletingImage} onClick={() => void deletePortfolioImage()}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove image
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          {pendingDeleteImage?.caption
            ? `“${pendingDeleteImage.caption}” will be removed from your public portfolio.`
            : 'This image will be removed from your public portfolio.'}
        </p>
      </Dialog>
    </div>
  );
}
