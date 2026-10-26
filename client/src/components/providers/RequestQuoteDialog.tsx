import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import type { ProviderDetail, ServiceRequestDetail } from '@shared/api-types';
import { requestCreateSchema } from '@shared/contracts';
import { api, fieldErrorsFrom } from '@/lib/api';
import { useAuth } from '@/auth/AuthProvider';
import { locationLabel } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { Dialog } from '@/components/ui/Dialog';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

type RequestFormValues = z.input<typeof requestCreateSchema>;

export function RequestQuoteDialog({
  provider,
  open,
  onOpenChange,
  initialCategoryId,
}: {
  provider: ProviderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategoryId?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const listing of provider.listings) map.set(listing.category.id, listing.category.name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [provider.listings]);

  const defaultCategoryId = useMemo(() => {
    if (initialCategoryId && categoryOptions.some((category) => category.id === initialCategoryId)) {
      return initialCategoryId;
    }
    return categoryOptions[0]?.id ?? '';
  }, [categoryOptions, initialCategoryId]);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestCreateSchema),
    defaultValues: {
      categoryId: defaultCategoryId,
      locationId: provider.serviceAreas[0]?.id ?? '',
      title: '',
      problemDescription: '',
      preferredSchedule: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      categoryId: defaultCategoryId,
      locationId: provider.serviceAreas[0]?.id ?? '',
      title: '',
      problemDescription: '',
      preferredSchedule: '',
    });
  }, [open, defaultCategoryId, provider.serviceAreas, form]);

  const canRequest = categoryOptions.length > 0 && provider.serviceAreas.length > 0;

  async function onSubmit(values: RequestFormValues) {
    try {
      const created = await api.post<ServiceRequestDetail>('/requests', {
        ...values,
        targetProviderId: provider.id,
      });
      toast.success('Your request was sent. Quotes will appear in your dashboard.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.customerDashboard });
      await queryClient.invalidateQueries({ queryKey: ['customer', 'requests'] });
      onOpenChange(false);
      navigate(`/customer/requests/${created.id}`);
    } catch (error) {
      const mapped = fieldErrorsFrom(error);
      if (mapped) {
        for (const [field, message] of Object.entries(mapped)) {
          if (field in form.getValues()) form.setError(field as keyof RequestFormValues, { message });
        }
      }
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Could not send the request. Try again.',
      });
    }
  }

  const loginNext = encodeURIComponent(location.pathname + location.search);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={user?.role === 'CUSTOMER' ? `Request a quote from ${provider.businessName}` : 'Request a quote'}
      description={
        user?.role === 'CUSTOMER'
          ? 'Describe the problem clearly. This provider will see your request and can respond with a quotation.'
          : 'Sign in with a customer account to send a service request.'
      }
      size="lg"
    >
      {!user ? (
        <div className="space-y-4">
          <Alert tone="info">
            You need a customer account so the provider can reply and so you can compare quotes
            safely.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Link to={`/login?next=${loginNext}`} className={buttonStyles({ variant: 'primary', size: 'md' })}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Log in to continue
            </Link>
            <Link to="/register?role=customer" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
              Create an account
            </Link>
          </div>
        </div>
      ) : user.role !== 'CUSTOMER' ? (
        <Alert tone="warning">
          Only customer accounts can request quotations. Provider and administrator accounts cannot
          send requests.
        </Alert>
      ) : !canRequest ? (
        <Alert tone="warning">
          This provider has not published an active service and service area yet, so a quote request
          cannot be created. Please check another provider.
        </Alert>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {form.formState.errors.root?.message ? (
            <Alert tone="error">{form.formState.errors.root.message}</Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="request-category"
              label="Service category"
              required
              error={form.formState.errors.categoryId?.message}
            >
              <Select id="request-category" {...form.register('categoryId')}>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="request-location"
              label="Service location"
              required
              error={form.formState.errors.locationId?.message}
              hint="Choose one of the provider's published service areas."
            >
              <Select id="request-location" {...form.register('locationId')}>
                {provider.serviceAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {locationLabel(area)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            id="request-title"
            label="What needs fixing?"
            required
            error={form.formState.errors.title?.message}
            hint="Example: “Laptop is very slow when opening apps.”"
          >
            <Input
              id="request-title"
              placeholder="Short title for the problem"
              maxLength={100}
              aria-invalid={Boolean(form.formState.errors.title)}
              {...form.register('title')}
            />
          </Field>
          <Field
            id="request-description"
            label="Describe the problem"
            required
            error={form.formState.errors.problemDescription?.message}
            hint="At least 20 characters. Do not include your home address or ID numbers."
          >
            <Textarea
              id="request-description"
              rows={5}
              maxLength={2000}
              placeholder="What happened, what you have already tried, and what outcome you need."
              aria-invalid={Boolean(form.formState.errors.problemDescription)}
              {...form.register('problemDescription')}
            />
          </Field>
          <Field
            id="request-schedule"
            label="Preferred schedule (optional)"
            error={form.formState.errors.preferredSchedule?.message}
            hint="For example: weekday mornings or Saturday afternoon."
          >
            <Input
              id="request-schedule"
              placeholder="When would you like the service?"
              maxLength={120}
              {...form.register('preferredSchedule')}
            />
          </Field>
          <Alert tone="info">
            Your email address is only shared with the provider whose quote you accept. Other
            providers see your request details without your contact information.
          </Alert>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Send request
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
