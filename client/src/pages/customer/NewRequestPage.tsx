import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Info, Lock, PlusCircle } from 'lucide-react';
import type { ServiceRequestDetail } from '@shared/api-types';
import { requestCreateSchema } from '@shared/contracts';
import { api, fieldErrorsFrom } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { useCategories, useLocations } from '@/hooks/catalog';
import { buildLocationOptions, groupLocationOptions } from '@/lib/locations';
import { PageHeader } from '@/components/ui/Brand';
import { buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { LoadingBlock } from '@/components/ui/Feedback';

type RequestFormValues = z.input<typeof requestCreateSchema>;

export function NewRequestPage() {
  useDocumentTitle('Post a repair request');
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const locations = useLocations();

  const locationGroups = useMemo(
    () => groupLocationOptions(buildLocationOptions(locations.data ?? [])),
    [locations.data],
  );

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestCreateSchema),
    defaultValues: {
      categoryId: '',
      locationId: user?.preferredLocationId ?? '',
      title: '',
      problemDescription: '',
      preferredSchedule: '',
    },
  });

  async function onSubmit(values: RequestFormValues) {
    try {
      const created = await api.post<ServiceRequestDetail>('/requests', values);
      toast.success('Request posted. Approved matching providers can now send quotes.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.customerDashboard });
      await queryClient.invalidateQueries({ queryKey: ['customer', 'requests'] });
      navigate(`/customer/requests/${created.id}`);
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped) {
        for (const [field, message] of Object.entries(mapped)) {
          if (field in form.getValues()) form.setError(field as keyof RequestFormValues, { message });
        }
      }
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Could not post the request. Try again.',
      });
    }
  }

  const catalogLoading = categories.isPending || locations.isPending;
  const catalogError = categories.isError || locations.isError;
  const noCatalogOptions = (categories.data?.length ?? 0) === 0 || (locations.data?.length ?? 0) === 0;

  return (
    <div className="space-y-5">
      <Link
        to="/customer/requests"
        className={buttonStyles({ variant: 'ghost', size: 'sm', className: '-ml-2' })}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to my requests
      </Link>

      <PageHeader
        eyebrow="New request"
        title="Describe what needs fixing"
        description="One clear request lets approved providers send comparable quotes. You choose whether to accept any of them."
      />

      {catalogLoading ? (
        <LoadingBlock label="Loading categories and locations…" />
      ) : catalogError ? (
        <Alert tone="error">
          We could not load the service catalog. Refresh the page and try again.
        </Alert>
      ) : noCatalogOptions ? (
        <Alert tone="warning">
          No active service categories or locations are available yet, so a request cannot be posted
          right now.
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <form onSubmit={form.handleSubmit(onSubmit)} className="card-surface space-y-5 p-5 sm:p-6" noValidate>
            {form.formState.errors.root?.message ? (
              <Alert tone="error">{form.formState.errors.root.message}</Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="new-request-category"
                label="Service category"
                required
                error={form.formState.errors.categoryId?.message}
              >
                <Select id="new-request-category" {...form.register('categoryId')}>
                  <option value="">Choose a service</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id="new-request-location"
                label="Where is the work?"
                required
                error={form.formState.errors.locationId?.message}
                hint="Pick your city or barangay. Avoid putting an exact address here."
              >
                <Select id="new-request-location" {...form.register('locationId')}>
                  <option value="">Choose a location</option>
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
              </Field>
            </div>

            <Field
              id="new-request-title"
              label="What needs fixing?"
              required
              error={form.formState.errors.title?.message}
              hint="Keep it short: “Aircon not cooling”, “Leaking kitchen pipe”."
            >
              <Input
                id="new-request-title"
                placeholder="Short title for the problem"
                maxLength={100}
                aria-invalid={Boolean(form.formState.errors.title)}
                {...form.register('title')}
              />
            </Field>

            <Field
              id="new-request-description"
              label="Describe the problem"
              required
              error={form.formState.errors.problemDescription?.message}
              hint="At least 20 characters. Mention what happened and what you already tried. Do not include ID numbers or gate codes."
            >
              <Textarea
                id="new-request-description"
                rows={6}
                maxLength={2000}
                placeholder="What happened, when it started, and what outcome you need."
                aria-invalid={Boolean(form.formState.errors.problemDescription)}
                {...form.register('problemDescription')}
              />
            </Field>

            <Field
              id="new-request-schedule"
              label="Preferred schedule (optional)"
              error={form.formState.errors.preferredSchedule?.message}
              hint="A general window is enough, for example “Saturday morning” or “weekday after 6pm”."
            >
              <Input
                id="new-request-schedule"
                placeholder="When would you like the service?"
                maxLength={120}
                {...form.register('preferredSchedule')}
              />
            </Field>

            <Alert tone="info">
              Your name, request details, and general area are shared with matching approved
              providers. Your email address and exact contact details stay hidden until you accept a
              quotation.
            </Alert>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
              <Link to="/customer/requests" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className={buttonStyles({ variant: 'primary', size: 'md' })}
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                {form.formState.isSubmitting ? 'Posting request…' : 'Post request'}
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="card-surface p-5">
              <h2 className="text-sm font-extrabold">What happens next</h2>
              <ol className="mt-3 space-y-3 text-xs leading-relaxed text-ink-soft">
                <li className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-800">
                    1
                  </span>
                  Approved providers whose services and areas match can send a quotation.
                </li>
                <li className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-800">
                    2
                  </span>
                  You compare price, notes, and estimated duration. Decline or accept each quote.
                </li>
                <li className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-800">
                    3
                  </span>
                  After you accept, the provider can start the job and later mark it complete.
                </li>
                <li className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-800">
                    4
                  </span>
                  Only after completion can you leave one review for that request.
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
              <p className="flex items-center gap-1.5 font-bold text-ink">
                <Lock className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
                Protect your privacy
              </p>
              <p className="mt-2">
                Do not post your home address, ID photos, bank details, or one-time passwords. Share
                access details only with the provider you accept, through a channel you trust.
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-ink-mute">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                No payment is collected through AyosDito. Agree the final scope and payment method
                directly.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
