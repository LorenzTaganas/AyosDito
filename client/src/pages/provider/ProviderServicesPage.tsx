import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleOff,
  ClipboardList,
  Pencil,
  Plus,
  Power,
  Trash2,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderSelf, ServiceListingDto } from '@shared/api-types';
import { MAX_PRICE_CENTAVOS } from '@shared/contracts';
import { api, fieldErrorsFrom } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { useCategories } from '@/hooks/catalog';
import {
  formatPeso,
  formatPesosInput,
  pesosToCentavos,
  priceTypeLabel,
  truncate,
} from '@/lib/format';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { DemoBadge } from '@/components/ui/Verification';

interface ServiceFormValues {
  categoryId: string;
  title: string;
  description: string;
  startingPrice: string;
  diagnosticFee: string;
  priceType: 'STARTING_FROM' | 'ESTIMATE' | 'FIXED';
  requiresInspection: boolean;
  isActive: boolean;
}

const EMPTY_FORM: ServiceFormValues = {
  categoryId: '',
  title: '',
  description: '',
  startingPrice: '',
  diagnosticFee: '',
  priceType: 'STARTING_FROM',
  requiresInspection: false,
  isActive: true,
};

export function ProviderServicesPage() {
  useDocumentTitle('Services & pricing');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const self = useQuery({
    queryKey: queryKeys.providerSelf,
    queryFn: () => api.get<ProviderSelf>('/providers/me'),
  });
  const categories = useCategories();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceListingDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServiceListingDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const serviceForm = useForm<ServiceFormValues>({ defaultValues: EMPTY_FORM });

  const provider = self.data;
  const activeCategories = (categories.data ?? []).filter((category) => category.isActive);
  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));
  const listings = provider?.listings ?? [];
  const activeCount = listings.filter((listing) => listing.isActive).length;

  async function refreshServiceViews() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.providerSelf }),
      queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
      queryClient.invalidateQueries({ queryKey: ['providers', 'search'] }),
    ]);
  }

  function openCreate() {
    setEditing(null);
    setFormError(null);
    serviceForm.reset(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(listing: ServiceListingDto) {
    setEditing(listing);
    setFormError(null);
    serviceForm.reset({
      categoryId: listing.categoryId,
      title: listing.title,
      description: listing.description ?? '',
      startingPrice: formatPesosInput(listing.startingPrice),
      diagnosticFee: listing.diagnosticFee === null ? '' : formatPesosInput(listing.diagnosticFee),
      priceType: listing.priceType,
      requiresInspection: listing.requiresInspection,
      isActive: listing.isActive,
    });
    setDialogOpen(true);
  }

  async function submitService(values: ServiceFormValues) {
    serviceForm.clearErrors();
    setFormError(null);

    const title = values.title.trim();
    const description = values.description.trim();
    let invalid = false;

    if (!values.categoryId) {
      serviceForm.setError('categoryId', { message: 'Choose a service category.' });
      invalid = true;
    }
    if (title.length < 3) {
      serviceForm.setError('title', { message: 'Enter a short service title (at least 3 characters).' });
      invalid = true;
    }
    if (description.length > 2000) {
      serviceForm.setError('description', { message: 'Keep the description under 2,000 characters.' });
      invalid = true;
    }

    const startingPrice = pesosToCentavos(values.startingPrice.trim());
    if (startingPrice === null || startingPrice <= 0) {
      serviceForm.setError('startingPrice', { message: 'Enter a starting price greater than zero.' });
      invalid = true;
    } else if (startingPrice > MAX_PRICE_CENTAVOS) {
      serviceForm.setError('startingPrice', { message: 'The starting price is too large.' });
      invalid = true;
    }

    let diagnosticFee: number | null = null;
    if (values.diagnosticFee.trim() !== '') {
      diagnosticFee = pesosToCentavos(values.diagnosticFee.trim());
      if (diagnosticFee === null || diagnosticFee < 0) {
        serviceForm.setError('diagnosticFee', { message: 'Enter a valid diagnostic fee, or leave it blank.' });
        invalid = true;
      } else if (diagnosticFee > MAX_PRICE_CENTAVOS) {
        serviceForm.setError('diagnosticFee', { message: 'The diagnostic fee is too large.' });
        invalid = true;
      }
    }
    if (invalid) return;

    setSaving(true);
    try {
      const payload = {
        categoryId: values.categoryId,
        title,
        description,
        startingPrice,
        diagnosticFee,
        priceType: values.priceType,
        requiresInspection: values.requiresInspection,
        isActive: values.isActive,
      };
      if (editing) {
        await api.patch<ServiceListingDto>(`/providers/me/services/${editing.id}`, payload);
        toast.success('Service updated.');
      } else {
        await api.post<ServiceListingDto>('/providers/me/services', payload);
        toast.success('Service added.');
      }
      await refreshServiceViews();
      setDialogOpen(false);
      setEditing(null);
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped) {
        for (const [field, message] of Object.entries(mapped)) {
          if (field in (EMPTY_FORM as unknown as Record<string, unknown>)) {
            serviceForm.setError(field as keyof ServiceFormValues, { message });
          }
        }
      } else {
        setFormError(error instanceof Error ? error.message : 'Could not save this service.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(listing: ServiceListingDto) {
    setBusyId(listing.id);
    setPageError(null);
    try {
      await api.patch<ServiceListingDto>(`/providers/me/services/${listing.id}`, {
        isActive: !listing.isActive,
      });
      await refreshServiceViews();
      toast.success(listing.isActive ? 'Service hidden from your profile.' : 'Service activated.');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not update this service.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteService() {
    if (!pendingDelete) return;
    setDeleting(true);
    setPageError(null);
    try {
      await api.delete(`/providers/me/services/${pendingDelete.id}`);
      await refreshServiceViews();
      toast.success('Service deleted.');
      setPendingDelete(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not delete this service.');
    } finally {
      setDeleting(false);
    }
  }

  if (self.isPending) {
    return <LoadingBlock label="Loading your services…" />;
  }

  if (self.isError || !provider) {
    return (
      <ErrorState
        message="We could not load your services. Check your connection and try again."
        onRetry={() => self.refetch()}
      />
    );
  }

  const approvalStatus = provider.approvalStatus;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Services & pricing"
        title="What you offer and how much it starts at"
        description="Each active listing tells customers what you handle and the price they can expect before they send a request."
        actions={
          <Button onClick={openCreate} disabled={activeCategories.length === 0 && categories.isSuccess}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add service
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-soft px-4 py-3 text-xs text-ink-soft">
        <Badge variant="brand">{activeCount} active</Badge>
        <Badge variant="outline">{listings.length} total</Badge>
        {provider.isDemo ? <DemoBadge label="Demo provider" /> : null}
        <span>
          {approvalStatus === 'APPROVED'
            ? 'Active services on an approved profile appear in the public directory. Keep prices honest and current.'
            : 'You can prepare listings now. They become visible to customers only after an administrator approves your profile.'}
        </span>
      </div>

      {pageError ? <Alert tone="error">{pageError}</Alert> : null}

      {categories.isError ? (
        <Alert tone="warning">
          Service categories could not be loaded, so the category picker may be incomplete. Refresh
          the page before adding a service.
        </Alert>
      ) : null}

      {listings.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
          title="No services yet"
          description="A service listing pairs a category with the work you do and a starting price. Without an active listing, your profile cannot appear in directory searches or match open requests."
          action={
            <Button onClick={openCreate} disabled={activeCategories.length === 0}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add your first service
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className={`card-surface p-4 sm:p-5 ${listing.isActive ? '' : 'opacity-80'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={listing.isActive ? 'brand' : 'outline'}>
                      {listing.isActive ? 'Active' : 'Hidden'}
                    </Badge>
                    <Badge variant="outline">{listing.category.name}</Badge>
                  </div>
                  <h2 className="mt-2 text-base font-bold leading-snug">{listing.title}</h2>
                  {listing.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {truncate(listing.description, 260)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-ink-mute">No description.</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                    {priceTypeLabel(listing.priceType)}
                  </p>
                  <p className="text-lg font-extrabold text-ink">{formatPeso(listing.startingPrice)}</p>
                  {listing.diagnosticFee !== null ? (
                    <p className="text-[11px] text-ink-mute">
                      {listing.diagnosticFee === 0 ? 'Free diagnostic' : `Diagnostic ${formatPeso(listing.diagnosticFee)}`}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                {listing.requiresInspection ? (
                  <Badge variant="sun">Inspection required before final price</Badge>
                ) : (
                  <Badge variant="outline">No inspection required</Badge>
                )}
                <Badge variant="outline">
                  {categoryById.get(listing.categoryId)?.name ?? listing.category.name}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/80 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void toggleActive(listing)}
                  loading={busyId === listing.id}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden="true" />
                  {listing.isActive ? 'Hide from profile' : 'Activate'}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(listing)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-clay hover:bg-clay-soft hover:text-clay"
                    onClick={() => setPendingDelete(listing)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="flex items-center gap-1.5 font-bold text-ink">
          <ClipboardList className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
          Starting prices are starting points
        </p>
        <p className="mt-2">
          A starting price is not a binding quotation. For work whose cost depends on the actual
          problem, mark that inspection is required and give a clear quotation after you understand
          the job. Customers compare the quote details, not just the number.
        </p>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormError(null);
        }}
        title={editing ? 'Edit service' : 'Add a service'}
        description={
          editing
            ? 'Update the scope or price. The directory and request matching update after saving.'
            : 'Describe one kind of work you can do. You can add more listings for other categories.'
        }
        size="lg"
      >
        <form onSubmit={serviceForm.handleSubmit(submitService)} className="space-y-4" noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="service-category"
              label="Category"
              required
              error={serviceForm.formState.errors.categoryId?.message}
            >
              <Select id="service-category" {...serviceForm.register('categoryId')}>
                <option value="">Choose a category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              id="service-price-type"
              label="Price type"
              hint="How customers should read the amount."
              error={serviceForm.formState.errors.priceType?.message}
            >
              <Select id="service-price-type" {...serviceForm.register('priceType')}>
                <option value="STARTING_FROM">Starting from</option>
                <option value="ESTIMATE">Typical estimate</option>
                <option value="FIXED">Fixed price</option>
              </Select>
            </Field>
          </div>

          <Field
            id="service-title"
            label="Service title"
            required
            hint="Keep it specific: for example, “Split-type aircon cleaning” instead of “Aircon services”."
            error={serviceForm.formState.errors.title?.message}
          >
            <Input id="service-title" maxLength={100} {...serviceForm.register('title')} />
          </Field>

          <Field
            id="service-description"
            label="Description"
            hint="What is included, what is not included, and anything the customer should prepare."
            error={serviceForm.formState.errors.description?.message}
          >
            <Textarea
              id="service-description"
              rows={4}
              maxLength={2000}
              placeholder="Example: Includes cleaning of the indoor unit and checking the drain line. Refrigerant top-up is quoted separately."
              {...serviceForm.register('description')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="service-starting-price"
              label="Starting price (₱)"
              required
              hint="Total amount in pesos, not a range."
              error={serviceForm.formState.errors.startingPrice?.message}
            >
              <Input
                id="service-starting-price"
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                placeholder="e.g. 500"
                {...serviceForm.register('startingPrice')}
              />
            </Field>

            <Field
              id="service-diagnostic-fee"
              label="Diagnostic fee (₱)"
              hint="Leave blank if there is no separate diagnostic fee."
              error={serviceForm.formState.errors.diagnosticFee?.message}
            >
              <Input
                id="service-diagnostic-fee"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                placeholder="e.g. 0 for a free check"
                {...serviceForm.register('diagnosticFee')}
              />
            </Field>
          </div>

          <div className="space-y-2 rounded-xl border border-line bg-paper/60 p-3.5 text-sm">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-600"
                {...serviceForm.register('requiresInspection')}
              />
              <span>
                <span className="font-semibold">Inspection required</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-mute">
                  Check this when the final price depends on seeing the unit or item first.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-600"
                {...serviceForm.register('isActive')}
              />
              <span>
                <span className="font-semibold">Active listing</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-mute">
                  Inactive listings stay on your account but are hidden from customers and excluded
                  from matching.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add service'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this service?"
        description="Deleting removes the listing permanently and recalculates your public starting price."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Keep service
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void deleteService()}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete service
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <div className="rounded-xl bg-paper px-4 py-3 text-sm">
            <p className="font-bold">{pendingDelete.title}</p>
            <p className="mt-1 text-xs text-ink-mute">{pendingDelete.category.name}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {priceTypeLabel(pendingDelete.priceType)} {formatPeso(pendingDelete.startingPrice)}
            </p>
          </div>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-ink-mute">
          Consider hiding the service instead if you may offer it again later. Existing requests and
          quotes keep their history either way.
        </p>
      </Dialog>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-mute">
        <CircleOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {user?.isDemo
          ? 'This demo provider’s services are seed data for showing the dashboard; they are not a real price list.'
          : 'AyosDito does not set prices and does not take a commission in this MVP. Agree the final price directly with the customer.'}
      </p>
    </div>
  );
}
