import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldPlus, UserCheck, UserRoundX, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserDto } from '@shared/api-types';
import { ACCOUNT_STATUSES, ROLES, type AccountStatus } from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { parseAdminFilter, errorMessage } from '@/lib/admin';
import { formatDate, pluralize } from '@/lib/format';
import { useAdminListParams } from '@/hooks/adminList';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { DemoBadge } from '@/components/ui/Verification';
import { AdminFilterTabs, AdminSearch } from '@/components/admin/AdminFilters';
import {
  AccountStatusBadge,
  ApprovalStatusBadge,
  RoleBadge,
  VerificationStatusBadge,
} from '@/components/admin/AdminBadges';
import {
  AdminTableBody,
  AdminTableShell,
  AdminTd,
  AdminTh,
  AdminThead,
  adminActionsCellClass,
  adminActionsHeaderClass,
} from '@/components/admin/AdminTable';

type PendingAction =
  | { kind: 'suspend' | 'reactivate'; user: AdminUserDto }
  | { kind: 'grant'; user: AdminUserDto };

const ROLE_TABS = [
  { value: 'ALL', label: 'All roles' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'PROVIDER', label: 'Providers' },
  { value: 'ADMIN', label: 'Administrators' },
];

export function AdminUsersPage() {
  useDocumentTitle('Users and roles');
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { params, page, update, reset } = useAdminListParams();
  const q = params.get('q') ?? '';
  const role = parseAdminFilter(params.get('role'), ROLES);
  const status = parseAdminFilter(params.get('status'), ACCOUNT_STATUSES);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: queryKeys.adminUsers({ q, role, status, page }),
    queryFn: () =>
      api.list<AdminUserDto>('/admin/users', {
        q: q || undefined,
        role: role === 'ALL' ? undefined : role,
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 20,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; accountStatus: AccountStatus; reason?: string }) =>
      api.patch<AdminUserDto>(`/admin/users/${input.userId}/status`, {
        accountStatus: input.accountStatus,
        reason: input.reason,
      }),
    onSuccess: async (_data, input) => {
      toast.success(
        input.accountStatus === 'SUSPENDED'
          ? 'Account suspended. Its active sessions were ended.'
          : 'Account reactivated. The person can sign in again.',
      );
      setPending(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => setFormError(errorMessage(error, 'Could not update this account.')),
  });

  const grantMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post<AdminUserDto>(`/admin/users/${userId}/grant-admin`, { role: 'ADMIN' }),
    onSuccess: async () => {
      toast.success('Administrator access granted. Existing sessions for this account were ended.');
      setPending(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard }),
      ]);
    },
    onError: (error) => setFormError(errorMessage(error, 'Could not grant administrator access.')),
  });

  function openAction(next: PendingAction) {
    setPending(next);
    setReason('');
    setFormError(null);
  }

  function submitAction(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;
    setFormError(null);

    if (pending.kind === 'grant') {
      grantMutation.mutate(pending.user.id);
      return;
    }

    const trimmed = reason.trim();
    if (pending.kind === 'suspend' && trimmed.length < 3) {
      setFormError('Explain why this account is being suspended (at least 3 characters).');
      return;
    }
    statusMutation.mutate({
      userId: pending.user.id,
      accountStatus: pending.kind === 'suspend' ? 'SUSPENDED' : 'ACTIVE',
      reason: trimmed || undefined,
    });
  }

  const hasFilters = Boolean(q) || role !== 'ALL' || status !== 'ALL';
  const busy = statusMutation.isPending || grantMutation.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="People and roles"
        description="Search customer, provider, and administrator accounts. Suspension ends active sessions immediately; promoting a customer to administrator cannot be undone from this screen."
      />

      <div className="space-y-3">
        <AdminFilterTabs
          label="Filter accounts by role"
          options={ROLE_TABS}
          value={role}
          onChange={(value) => update({ role: value === 'ALL' ? null : value })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch placeholder="Search name, email, or business" label="Search accounts" />
          <div className="w-full sm:w-44">
            <label htmlFor="account-status-filter" className="sr-only">
              Filter by account status
            </label>
            <Select
              id="account-status-filter"
              value={status}
              onChange={(event) =>
                update({ status: event.target.value === 'ALL' ? null : event.target.value })
              }
              className="h-10"
            >
              <option value="ALL">All account statuses</option>
              <option value="ACTIVE">Active only</option>
              <option value="SUSPENDED">Suspended only</option>
            </Select>
          </div>
        </div>
      </div>

      {users.isPending ? (
        <LoadingBlock label="Loading accounts…" />
      ) : users.isError ? (
        <ErrorState
          message="We could not load accounts. Check your connection and try again."
          onRetry={() => users.refetch()}
        />
      ) : users.data.data.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
          title="No accounts match these filters"
          description={
            hasFilters
              ? 'Try another role or status, change the search term, or clear every filter.'
              : 'No accounts exist yet.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={reset}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {pluralize(users.data.meta.total, 'account')}
              {q ? ` · matching “${q}”` : ''}
            </p>
            <Badge variant="outline">
              Page {users.data.meta.page} of {Math.max(1, users.data.meta.totalPages)}
            </Badge>
          </div>

          <AdminTableShell label="User accounts" minWidth={800}>
            <AdminThead>
              <tr>
                <AdminTh>Person</AdminTh>
                <AdminTh>Role and provider</AdminTh>
                <AdminTh>Account</AdminTh>
                <AdminTh className={adminActionsHeaderClass}>Actions</AdminTh>
              </tr>
            </AdminThead>
            <AdminTableBody>
              {users.data.data.map((row) => (
                <tr
                  key={row.id}
                  role="row"
                  className="block py-2 transition hover:bg-paper/70 xl:table-row xl:py-0"
                >
                  <AdminTd>
                    <div className="flex items-start gap-2.5">
                      <Avatar name={row.fullName} size="sm" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                          <span className="break-words">{row.fullName}</span>
                          {row.isDemo ? <DemoBadge /> : null}
                          {row.id === currentUser?.id ? <Badge variant="outline">You</Badge> : null}
                        </p>
                        <p className="mt-0.5 break-all text-xs text-ink-mute">{row.email}</p>
                        <p
                          className={`mt-1 text-[11px] font-medium ${
                            row.emailVerified ? 'text-ink-mute' : 'text-clay'
                          }`}
                        >
                          {row.emailVerified ? 'Email verified' : 'Email not verified'}
                        </p>
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd label="Role and provider">
                    <div className="min-w-0 max-w-[15rem]">
                      <RoleBadge role={row.role} />
                      {row.provider ? (
                        <div className="mt-1.5">
                          <p className="break-words text-xs font-semibold text-ink">
                            {row.provider.businessName}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <ApprovalStatusBadge status={row.provider.approvalStatus} />
                            <VerificationStatusBadge status={row.provider.verificationStatus} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </AdminTd>
                  <AdminTd label="Account">
                    <AccountStatusBadge status={row.accountStatus} />
                    <p className="mt-1.5 whitespace-nowrap text-[11px] text-ink-mute">
                      Joined {formatDate(row.createdAt)}
                    </p>
                  </AdminTd>
                  <AdminTd label="Actions" className={adminActionsCellClass}>
                    <div className="flex flex-wrap justify-end gap-2 xl:flex-col xl:items-end xl:gap-1.5">
                      {row.role === 'ADMIN' ? (
                        <span
                          className="text-[11px] text-ink-mute"
                          title="Administrator accounts cannot be suspended from this screen."
                        >
                          {row.id === currentUser?.id ? 'Current account' : 'Admin protected'}
                        </span>
                      ) : (
                        <>
                          {row.accountStatus === 'SUSPENDED' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openAction({ kind: 'reactivate', user: row })}
                            >
                              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-clay"
                              onClick={() => openAction({ kind: 'suspend', user: row })}
                            >
                              <UserRoundX className="h-3.5 w-3.5" aria-hidden="true" />
                              Suspend
                            </Button>
                          )}
                          {row.role === 'CUSTOMER' &&
                          row.accountStatus === 'ACTIVE' &&
                          row.emailVerified ? (
                            <Button
                              variant="subtle"
                              size="sm"
                              onClick={() => openAction({ kind: 'grant', user: row })}
                            >
                              <ShieldPlus className="h-3.5 w-3.5" aria-hidden="true" />
                              Grant admin
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableShell>

          <Pagination
            page={users.data.meta.page}
            pageSize={users.data.meta.pageSize}
            total={users.data.meta.total}
            totalPages={users.data.meta.totalPages}
            onPageChange={(nextPage) => {
              update({ page: String(nextPage) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Access rules</p>
        <p className="mt-2">
          The server rejects administrator actions from non-admins on every request. Only verified,
          active customer accounts can be promoted, and administrator accounts themselves cannot be
          suspended from this screen. Promotion is recorded in the audit log and ends the account’s
          existing sessions.
        </p>
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={
          !pending
            ? ''
            : pending.kind === 'suspend'
              ? `Suspend ${pending.user.fullName}?`
              : pending.kind === 'reactivate'
                ? `Reactivate ${pending.user.fullName}?`
                : `Grant administrator access to ${pending.user.fullName}?`
        }
        description={
          !pending
            ? undefined
            : pending.kind === 'suspend'
              ? 'The account is signed out and blocked from signing in. Provider profiles are hidden from the public directory while suspended.'
              : pending.kind === 'reactivate'
                ? 'The person can sign in and use the marketplace again. Sessions ended by the suspension are not restored.'
                : 'This changes a customer account into a full administrator account. Review the consequences before confirming.'
        }
      >
        {pending ? (
          <form id="user-action-form" onSubmit={submitAction} className="space-y-4">
            {formError ? <Alert tone="error">{formError}</Alert> : null}

            {pending.kind === 'grant' ? (
              <Alert tone="warning" title="Full moderation access">
                This account will be able to approve providers, verify identities, suspend accounts,
                moderate reviews, resolve reports, and change categories or locations. Administrator
                access cannot be revoked from this screen, and the account’s current sessions will
                end immediately.
              </Alert>
            ) : (
              <>
                <div className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs text-ink-soft">
                  <p className="font-semibold text-ink">{pending.user.email}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <span>Joined {formatDate(pending.user.createdAt)}</span>
                    <RoleBadge role={pending.user.role} />
                  </p>
                </div>
                <Field
                  id="status-reason"
                  label={pending.kind === 'suspend' ? 'Reason for suspension' : 'Note (optional)'}
                  required={pending.kind === 'suspend'}
                  hint="Recorded in the audit log. Do not include passwords or other secrets."
                >
                  <Textarea
                    id="status-reason"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={
                      pending.kind === 'suspend'
                        ? 'Example: Repeated harassment reports confirmed by the moderation team.'
                        : 'Example: Suspension reviewed and lifted after appeal.'
                    }
                  />
                </Field>
              </>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPending(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={pending.kind === 'suspend' ? 'danger' : 'primary'}
                loading={busy}
              >
                {pending.kind === 'suspend'
                  ? 'Suspend account'
                  : pending.kind === 'reactivate'
                    ? 'Reactivate account'
                    : 'Grant administrator access'}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
