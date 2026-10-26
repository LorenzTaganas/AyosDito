import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Eye,
  EyeOff,
  Globe2,
  Map as MapIcon,
  MapPin,
  Pencil,
  PlusCircle,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminLocationDto } from '@shared/api-types';
import { LOCATION_TYPES, type LocationType } from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import {
  LOCATION_PARENT_TYPES,
  LOCATION_TYPE_LABELS,
  errorMessage,
  parseAdminFilter,
} from '@/lib/admin';
import { pluralize } from '@/lib/format';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { AdminFilterTabs } from '@/components/admin/AdminFilters';
import {
  AdminTableBody,
  AdminTableShell,
  AdminTd,
  AdminTh,
  AdminThead,
  adminActionsCellClass,
  adminActionsHeaderClass,
} from '@/components/admin/AdminTable';

const TYPE_ORDER: Record<LocationType, number> = {
  REGION: 0,
  PROVINCE: 1,
  CITY: 2,
  BARANGAY: 3,
};

const TYPE_ICONS: Record<LocationType, LucideIcon> = {
  REGION: Globe2,
  PROVINCE: MapIcon,
  CITY: Building2,
  BARANGAY: MapPin,
};

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'All places' },
  { value: 'REGION', label: 'Regions' },
  { value: 'PROVINCE', label: 'Provinces' },
  { value: 'CITY', label: 'Cities' },
  { value: 'BARANGAY', label: 'Barangays' },
];

interface LocationForm {
  name: string;
  locationType: LocationType;
  parentId: string;
  isActive: boolean;
}

const EMPTY_FORM: LocationForm = {
  name: '',
  locationType: 'CITY',
  parentId: '',
  isActive: true,
};

function isDescendant(
  candidateId: string,
  ancestorId: string,
  rows: AdminLocationDto[],
): boolean {
  const byId = new Map(rows.map((row) => [row.id, row]));
  let cursor = byId.get(candidateId)?.parentId ?? null;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === ancestorId) return true;
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}

export function AdminLocationsPage() {
  useDocumentTitle('Locations');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<LocationType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLocationDto | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [hiding, setHiding] = useState<AdminLocationDto | null>(null);

  const locations = useQuery({
    queryKey: queryKeys.adminLocations,
    queryFn: () => api.get<AdminLocationDto[]>('/admin/locations'),
  });

  const saveMutation = useMutation({
    mutationFn: (input: LocationForm & { id?: string }) => {
      const payload = {
        name: input.name,
        locationType: input.locationType,
        parentId: input.locationType === 'REGION' ? null : input.parentId,
        isActive: input.isActive,
      };
      return input.id
        ? api.patch<AdminLocationDto>(`/admin/locations/${input.id}`, payload)
        : api.post<AdminLocationDto>('/admin/locations', payload);
    },
    onSuccess: async (_data, input) => {
      toast.success(input.id ? 'Location updated.' : 'Location created.');
      setFormOpen(false);
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] }),
        queryClient.invalidateQueries({ queryKey: ['locations'] }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => setFormError(errorMessage(error, 'Could not save this location.')),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { location: AdminLocationDto; isActive: boolean }) =>
      api.patch<AdminLocationDto>(`/admin/locations/${input.location.id}`, {
        isActive: input.isActive,
      }),
    onSuccess: async (_data, input) => {
      toast.success(
        input.isActive
          ? `${input.location.name} is now active.`
          : `${input.location.name} was hidden. Any active child places beneath it were deactivated too.`,
      );
      setHiding(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] }),
        queryClient.invalidateQueries({ queryKey: ['locations'] }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Could not change this location.'));
      setHiding(null);
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(locations.data ?? [])]
      .filter((location) => {
        if (filter !== 'ALL' && location.locationType !== filter) return false;
        if (!term) return true;
        return (
          location.name.toLowerCase().includes(term) ||
          (location.parentName ?? '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const typeDifference = TYPE_ORDER[a.locationType] - TYPE_ORDER[b.locationType];
        return typeDifference !== 0 ? typeDifference : a.name.localeCompare(b.name);
      });
  }, [locations.data, filter, search]);

  const allRows = locations.data ?? [];
  const parentOptions = useMemo(() => {
    const allowed = LOCATION_PARENT_TYPES[form.locationType];
    return allRows
      .filter(
        (location) =>
          allowed.includes(location.locationType) &&
          location.id !== editing?.id &&
          !(editing && isDescendant(location.id, editing.id, allRows)),
      )
      .sort((a, b) => {
        const typeDifference = TYPE_ORDER[a.locationType] - TYPE_ORDER[b.locationType];
        return typeDifference !== 0 ? typeDifference : a.name.localeCompare(b.name);
      });
  }, [allRows, editing, form.locationType]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(location: AdminLocationDto) {
    setEditing(location);
    setForm({
      name: location.name,
      locationType: location.locationType,
      parentId: location.parentId ?? '',
      isActive: location.isActive,
    });
    setFormError(null);
    setFormOpen(true);
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) {
      setFormError('Enter a place name of at least 2 characters.');
      return;
    }
    if (form.locationType !== 'REGION' && !form.parentId) {
      setFormError('Choose a parent location.');
      return;
    }
    setFormError(null);
    saveMutation.mutate({
      ...form,
      name,
      id: editing?.id,
    });
  }

  const hasLocalFilters = filter !== 'ALL' || search.trim().length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catalog"
        title="Locations and service areas"
        description="Regions, provinces, cities, and barangays used by providers and customer requests. Hiding a place cascades to the places beneath it; nothing is deleted."
        actions={
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add location
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminFilterTabs
          label="Filter locations by type"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => setFilter(parseAdminFilter(value, LOCATION_TYPES))}
        />
        <div className="relative w-full sm:w-72">
          <label htmlFor="location-search" className="sr-only">
            Search locations
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
            aria-hidden="true"
          />
          <Input
            id="location-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search place or parent"
            className="h-10 pl-9"
          />
        </div>
      </div>

      {locations.isPending ? (
        <LoadingBlock label="Loading locations…" />
      ) : locations.isError ? (
        <ErrorState
          message="We could not load locations. Check your connection and try again."
          onRetry={() => locations.refetch()}
        />
      ) : allRows.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
          title="No locations yet"
          description="Start with a region, then add provinces or cities, and barangays under cities."
          action={<Button onClick={openCreate}>Add location</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
          title="No places match these filters"
          description="Try another type or search term."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setFilter('ALL');
                setSearch('');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {pluralize(rows.length, 'place')}
              {hasLocalFilters ? ` · filtered from ${allRows.length}` : ''}
            </p>
            <Badge variant="outline">Hierarchy: region → province / city → barangay</Badge>
          </div>

          <AdminTableShell label="Locations" minWidth={860}>
            <AdminThead>
              <tr>
                <AdminTh>Place</AdminTh>
                <AdminTh>Parent</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Child places</AdminTh>
                <AdminTh>Service areas</AdminTh>
                <AdminTh>Requests</AdminTh>
                <AdminTh className={adminActionsHeaderClass}>Actions</AdminTh>
              </tr>
            </AdminThead>
            <AdminTableBody>
              {rows.map((location) => {
                const TypeIcon = TYPE_ICONS[location.locationType];
                return (
                  <tr
                    key={location.id}
                    role="row"
                    className="block py-2 transition hover:bg-paper/70 xl:table-row xl:py-0"
                  >
                    <AdminTd>
                      <div className="flex items-start gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                          <TypeIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-ink">{location.name}</p>
                          <p className="mt-0.5 text-[11px] text-ink-mute">
                            {LOCATION_TYPE_LABELS[location.locationType]}
                          </p>
                        </div>
                      </div>
                    </AdminTd>
                    <AdminTd label="Parent place">
                      <span className="text-xs text-ink-soft">{location.parentName ?? '—'}</span>
                    </AdminTd>
                    <AdminTd label="Status">
                      <Badge variant={location.isActive ? 'brand' : 'neutral'}>
                        {location.isActive ? 'Active' : 'Hidden'}
                      </Badge>
                    </AdminTd>
                    <AdminTd label="Child places">
                      <span className="text-sm font-semibold">{location.childCount}</span>
                    </AdminTd>
                    <AdminTd label="Service areas">
                      <span className="text-sm font-semibold">{location.serviceAreaCount}</span>
                    </AdminTd>
                    <AdminTd label="Requests">
                      <span className="text-sm font-semibold">{location.requestCount}</span>
                    </AdminTd>
                    <AdminTd label="Actions" className={adminActionsCellClass}>
                      <div className="flex flex-wrap justify-end gap-2 xl:flex-col xl:items-end xl:gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(location)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                        {location.isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-clay"
                            onClick={() => setHiding(location)}
                          >
                            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                            Hide
                          </Button>
                        ) : (
                          <Button
                            variant="subtle"
                            size="sm"
                            loading={
                              toggleMutation.isPending &&
                              toggleMutation.variables?.location.id === location.id
                            }
                            onClick={() => toggleMutation.mutate({ location, isActive: true })}
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Activate
                          </Button>
                        )}
                      </div>
                    </AdminTd>
                  </tr>
                );
              })}
            </AdminTableBody>
          </AdminTableShell>
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Location rules</p>
        <p className="mt-2">
          A province sits under a region. A city sits under a region or province. A barangay sits
          under a city. A place cannot be moved beneath itself or one of its own children. Hiding a
          place also hides its active child places, but existing requests and service areas keep
          their references.
        </p>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) {
            setFormOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? `Edit ${editing.name}` : 'Add a location'}
        description="Location names and hierarchy are shared by provider service areas and customer requests."
      >
        <form id="location-form" onSubmit={submitForm} className="space-y-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <Field id="location-name" label="Place name" required hint="2–80 characters.">
            <Input
              id="location-name"
              value={form.name}
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Example: Malolos"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="location-type"
              label="Place type"
              hint={
                editing && editing.childCount > 0
                  ? 'This place has child places, so its type cannot be changed here.'
                  : 'Changing the type may require a different parent.'
              }
            >
              <Select
                id="location-type"
                value={form.locationType}
                disabled={Boolean(editing && editing.childCount > 0)}
                onChange={(event) => {
                  const locationType = event.target.value as LocationType;
                  setForm((current) => ({ ...current, locationType, parentId: '' }));
                }}
              >
                {LOCATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LOCATION_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              id="location-parent"
              label="Parent place"
              required={form.locationType !== 'REGION'}
              hint={
                form.locationType === 'REGION'
                  ? 'Regions are top-level and have no parent.'
                  : `A ${LOCATION_TYPE_LABELS[form.locationType].toLowerCase()} must sit under a ${LOCATION_PARENT_TYPES[
                      form.locationType
                    ]
                      .map((type) => LOCATION_TYPE_LABELS[type].toLowerCase())
                      .join(' or ')}.`
              }
            >
              <Select
                id="location-parent"
                value={form.parentId}
                disabled={form.locationType === 'REGION'}
                onChange={(event) =>
                  setForm((current) => ({ ...current, parentId: event.target.value }))
                }
              >
                <option value="">
                  {form.locationType === 'REGION' ? 'No parent (top level)' : 'Choose a parent place'}
                </option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({LOCATION_TYPE_LABELS[option.locationType]})
                    {option.isActive ? '' : ' · inactive'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {form.locationType !== 'REGION' && parentOptions.length === 0 ? (
            <Alert tone="warning">
              No eligible parent places exist yet. Create the parent level first, then add this
              place.
            </Alert>
          ) : null}

          <label className="flex items-start gap-2.5 rounded-xl border border-line bg-paper px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-600"
            />
            <span>
              <span className="font-semibold text-ink">Active for new listings and requests</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-mute">
                Deactivating a place also deactivates its child places. A place cannot be active if
                its parent is inactive.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editing ? 'Save changes' : 'Create location'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={hiding !== null}
        onOpenChange={(open) => {
          if (!open && !toggleMutation.isPending) setHiding(null);
        }}
        title={hiding ? `Hide ${hiding.name}?` : ''}
        description="The place and its active child places stop being available for new listings and requests. Existing references are kept."
        size="sm"
      >
        {hiding ? (
          <div className="space-y-4">
            <Alert tone="warning">
              {hiding.childCount > 0
                ? `${pluralize(hiding.childCount, 'child place')} will also be deactivated, including any active places beneath them.`
                : 'This place has no child places. Existing requests and provider service areas keep their references.'}
            </Alert>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setHiding(null)}
                disabled={toggleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate({ location: hiding, isActive: false })}
              >
                <EyeOff className="h-4 w-4" aria-hidden="true" />
                Hide location
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
