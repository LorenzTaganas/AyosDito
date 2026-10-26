import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, PlusCircle, Search, Tags } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminCategoryDto } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { errorMessage, humanizeKey, parseAdminFilter } from '@/lib/admin';
import { CATEGORY_ICON_NAMES, categoryIcon } from '@/lib/categoryIcons';
import { pluralize, truncate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { IconTile } from '@/components/ui/Avatar';
import { AdminFilterTabs } from '@/components/admin/AdminFilters';
import { AdminTableBody, AdminTableShell, AdminTd, AdminTh, AdminThead } from '@/components/admin/AdminTable';

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'All categories' },
  { value: 'ACTIVE', label: 'Publicly listed' },
  { value: 'HIDDEN', label: 'Hidden' },
];

interface CategoryForm {
  name: string;
  description: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  description: '',
  icon: 'wrench',
  sortOrder: '0',
  isActive: true,
};

export function AdminCategoriesPage() {
  useDocumentTitle('Service categories');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategoryDto | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<AdminCategoryDto | null>(null);

  const categories = useQuery({
    queryKey: queryKeys.adminCategories,
    queryFn: () => api.get<AdminCategoryDto[]>('/admin/categories'),
  });

  const saveMutation = useMutation({
    mutationFn: (input: CategoryForm & { id?: string }) => {
      const payload = {
        name: input.name,
        description: input.description,
        icon: input.icon,
        sortOrder: Number(input.sortOrder),
        isActive: input.isActive,
      };
      return input.id
        ? api.patch<AdminCategoryDto>(`/admin/categories/${input.id}`, payload)
        : api.post<AdminCategoryDto>('/admin/categories', payload);
    },
    onSuccess: async (_data, input) => {
      toast.success(input.id ? 'Category updated.' : 'Category created.');
      setFormOpen(false);
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => setFormError(errorMessage(error, 'Could not save this category.')),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { category: AdminCategoryDto; isActive: boolean }) =>
      api.patch<AdminCategoryDto>(`/admin/categories/${input.category.id}`, {
        isActive: input.isActive,
      }),
    onSuccess: async (_data, input) => {
      toast.success(
        input.isActive
          ? `${input.category.name} is now listed publicly.`
          : `${input.category.name} is now hidden from the public catalog.`,
      );
      setDeactivating(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Could not change this category.'));
      setDeactivating(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(category: AdminCategoryDto) {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? '',
      icon: category.icon,
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
    });
    setFormError(null);
    setFormOpen(true);
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const sortOrder = Number(form.sortOrder);
    if (name.length < 2) {
      setFormError('Enter a category name of at least 2 characters.');
      return;
    }
    if (!form.icon) {
      setFormError('Choose an icon.');
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
      setFormError('Sort order must be a whole number between 0 and 999.');
      return;
    }
    setFormError(null);
    saveMutation.mutate({
      ...form,
      name,
      description: form.description.trim(),
      sortOrder: String(sortOrder),
      id: editing?.id,
    });
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (categories.data ?? []).filter((category) => {
      if (filter === 'ACTIVE' && !category.isActive) return false;
      if (filter === 'HIDDEN' && category.isActive) return false;
      if (!term) return true;
      return (
        category.name.toLowerCase().includes(term) ||
        category.slug.toLowerCase().includes(term) ||
        (category.description ?? '').toLowerCase().includes(term)
      );
    });
  }, [categories.data, filter, search]);

  const hasLocalFilters = filter !== 'ALL' || search.trim().length > 0;
  const SelectedIcon = categoryIcon(form.icon);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catalog"
        title="Service categories"
        description="Categories group provider listings and customer requests. Hiding a category removes it from public browsing without deleting its history."
        actions={
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add category
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminFilterTabs
          label="Filter categories by visibility"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => setFilter(parseAdminFilter(value, ['ACTIVE', 'HIDDEN'] as const))}
        />
        <div className="relative w-full sm:w-72">
          <label htmlFor="category-search" className="sr-only">
            Search categories
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
            aria-hidden="true"
          />
          <Input
            id="category-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, slug, or description"
            className="h-10 pl-9"
          />
        </div>
      </div>

      {categories.isPending ? (
        <LoadingBlock label="Loading categories…" />
      ) : categories.isError ? (
        <ErrorState
          message="We could not load service categories. Check your connection and try again."
          onRetry={() => categories.refetch()}
        />
      ) : categories.data.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-5 w-5" aria-hidden="true" />}
          title="No categories yet"
          description="Create the first service category so providers can list what they repair and customers can post requests."
          action={<Button onClick={openCreate}>Add category</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-5 w-5" aria-hidden="true" />}
          title="No categories match these filters"
          description="Try another visibility filter or search term."
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
              {pluralize(visible.length, 'category', 'categories')}
              {hasLocalFilters ? ` · filtered from ${categories.data.length}` : ''}
            </p>
            <Badge variant="outline">Changes are logged</Badge>
          </div>

          <AdminTableShell label="Service categories" minWidth={900}>
            <AdminThead>
              <tr>
                <AdminTh>Category</AdminTh>
                <AdminTh>Visibility</AdminTh>
                <AdminTh>Listings</AdminTh>
                <AdminTh>Requests</AdminTh>
                <AdminTh>Order</AdminTh>
                <AdminTh className="text-right">Actions</AdminTh>
              </tr>
            </AdminThead>
            <AdminTableBody>
              {visible.map((category) => (
                <tr key={category.id} className="transition hover:bg-paper/70">
                  <AdminTd>
                    <div className="flex items-start gap-3">
                      <IconTile icon={categoryIcon(category.icon)} size="sm" />
                      <div className="min-w-0 max-w-sm">
                        <p className="text-sm font-bold text-ink">{category.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-mute">/{category.slug}</p>
                        {category.description ? (
                          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                            {truncate(category.description, 160)}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] italic text-ink-mute">No description.</p>
                        )}
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <Badge variant={category.isActive ? 'brand' : 'neutral'}>
                      {category.isActive ? 'Publicly listed' : 'Hidden'}
                    </Badge>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-sm font-semibold">{category.listingCount}</span>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-sm font-semibold">{category.requestCount}</span>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs font-mono">{category.sortOrder}</span>
                  </AdminTd>
                  <AdminTd className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(category)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                      {category.isActive ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-clay"
                          loading={
                            toggleMutation.isPending &&
                            toggleMutation.variables?.category.id === category.id
                          }
                          onClick={() => setDeactivating(category)}
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
                            toggleMutation.variables?.category.id === category.id
                          }
                          onClick={() => toggleMutation.mutate({ category, isActive: true })}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Publish
                        </Button>
                      )}
                    </div>
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableShell>
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Why categories are hidden, not deleted</p>
        <p className="mt-2">
          Deleting a category would break historical requests and listings. Hiding it removes the
          category from public browsing and request creation while keeping records intact. Provider
          ratings are recalculated when category visibility changes.
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
        title={editing ? `Edit ${editing.name}` : 'Add a service category'}
        description="The slug is generated from the name and kept unique by the server."
        size="lg"
      >
        <form id="category-form" onSubmit={submitForm} className="space-y-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <Field id="category-name" label="Category name" required hint="2–60 characters.">
            <Input
              id="category-name"
              value={form.name}
              maxLength={60}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Example: Air-conditioner repair"
            />
          </Field>

          <fieldset>
            <legend className="field-label">Icon</legend>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {CATEGORY_ICON_NAMES.map((iconName) => {
                const Icon = categoryIcon(iconName);
                const selected = form.icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    aria-pressed={selected}
                    aria-label={humanizeKey(iconName)}
                    title={humanizeKey(iconName)}
                    onClick={() => setForm((current) => ({ ...current, icon: iconName }))}
                    className={cn(
                      'grid h-10 place-items-center rounded-lg border transition',
                      selected
                        ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-600/20'
                        : 'border-line bg-white/70 text-ink-soft hover:border-brand-200 hover:bg-brand-50/50',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <p className="field-help flex items-center gap-1.5">
              <SelectedIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Selected: {humanizeKey(form.icon)}
            </p>
          </fieldset>

          <Field
            id="category-description"
            label="Description"
            hint="Optional, up to 300 characters. Shown on the public services page."
          >
            <Textarea
              id="category-description"
              rows={3}
              maxLength={300}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Example: Cleaning, repair, and installation for split and window-type air conditioners."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="category-sort-order"
              label="Sort order"
              hint="Lower numbers appear first. 0–999."
            >
              <Input
                id="category-sort-order"
                type="number"
                min={0}
                max={999}
                step={1}
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sortOrder: event.target.value }))
                }
              />
            </Field>

            <label className="flex items-start gap-2.5 rounded-xl border border-line bg-paper px-3 py-3 text-sm sm:mt-7">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-600"
              />
              <span>
                <span className="font-semibold text-ink">Visible in the public catalog</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-mute">
                  Providers and customers can select this category.
                </span>
              </span>
            </label>
          </div>

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
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open && !toggleMutation.isPending) setDeactivating(null);
        }}
        title={deactivating ? `Hide ${deactivating.name}?` : ''}
        description="The category disappears from public browsing and from the request form. Existing listings and requests keep their category."
        size="sm"
      >
        {deactivating ? (
          <div className="space-y-4">
            <Alert tone="warning">
              {deactivating.listingCount > 0
                ? `${pluralize(deactivating.listingCount, 'provider listing')} use this category. Providers’ visible prices and ratings may change while it is hidden.`
                : 'No provider listings currently use this category.'}
            </Alert>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeactivating(null)}
                disabled={toggleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate({ category: deactivating, isActive: false })}
              >
                <EyeOff className="h-4 w-4" aria-hidden="true" />
                Hide category
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
