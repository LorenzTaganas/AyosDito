import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Flag, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import type { ReportCreatedDto } from '@shared/api-types';
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportEntityType,
  type ReportReason,
} from '@shared/contracts';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthProvider';
import { Dialog } from '@/components/ui/Dialog';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

export function ReportDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ReportEntityType;
  entityId: string;
  entityLabel: string;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [reason, setReason] = useState<ReportReason>('MISLEADING_INFO');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('MISLEADING_INFO');
    setDescription('');
    setError(null);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (description.trim().length < 10) {
      setError('Give a short explanation of at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post<ReportCreatedDto>('/reports', {
        entityType,
        entityId,
        reason,
        description: description.trim(),
      });
      toast.success('Report sent to the moderation queue.');
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send the report.');
    } finally {
      setSubmitting(false);
    }
  }

  const loginNext = encodeURIComponent(location.pathname + location.search);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Report ${entityLabel}`}
      description="Reports go to an administrator for review. A report does not automatically remove content."
    >
      {!user ? (
        <div className="space-y-4">
          <Alert tone="info">Sign in to send a report so moderators can follow up safely.</Alert>
          <Link to={`/login?next=${loginNext}`} className={buttonStyles({ variant: 'primary', size: 'md' })}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Log in to report
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field id="report-reason" label="Reason" required>
            <Select
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
            >
              {REPORT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REPORT_REASON_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="report-description"
            label="What should the moderator know?"
            required
            hint="At least 10 characters. Do not include private ID or payment details."
          >
            <Textarea
              id="report-description"
              rows={4}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the problem with this profile or review."
            />
          </Field>
          <Alert tone="warning">
            Submitting knowingly false reports may lead to account restrictions. Urgent safety
            concerns should be raised with local authorities as well.
          </Alert>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={submitting}>
              <Flag className="h-4 w-4" aria-hidden="true" />
              Send report
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
