import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { ResendVerificationResponse } from '@shared/api-types';
import { api } from '@/lib/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthProvider';

export function EmailVerificationNotice() {
  const { user, refresh } = useAuth();
  const [sending, setSending] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified) return null;

  async function resend() {
    setSending(true);
    try {
      const result = await api.post<ResendVerificationResponse>('/auth/resend-verification');
      setSent(true);
      setSentUrl(result.devVerificationUrl ?? null);
      toast.success('A new verification link was generated.');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate a verification link.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Alert tone="warning" title="Your email address is not verified yet">
      <p>
        Verification helps protect account recovery. This MVP may not have email delivery
        configured; if no message arrives, an administrator can help in a development environment.
      </p>
      {sentUrl ? (
        <p className="mt-2">
          Development link:{' '}
          <a href={sentUrl} className="font-semibold underline underline-offset-2">
            open the verification page
          </a>
          .
        </p>
      ) : sent ? (
        <p className="mt-2">If email delivery is configured, check your inbox for the link.</p>
      ) : (
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" loading={sending} onClick={resend}>
            <MailCheck className="h-4 w-4" aria-hidden="true" />
            Generate verification link
          </Button>
        </div>
      )}
    </Alert>
  );
}
