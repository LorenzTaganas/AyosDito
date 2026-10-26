import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import type { QuoteDto } from '@shared/api-types';
import { api } from '@/lib/api';
import { formatPesosInput, pesosToCentavos } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field, Input, Textarea } from '@/components/ui/Field';

export function QuoteFormDialog({
  open,
  onOpenChange,
  requestId,
  quote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  quote?: QuoteDto | null;
}) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrice(quote ? formatPesosInput(quote.proposedPrice) : '');
    setNotes(quote?.priceNotes ?? '');
    setDuration(quote?.estimatedDuration ?? '');
    setError(null);
  }, [open, quote]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const centavos = pesosToCentavos(price.trim());
    if (centavos === null || !Number.isFinite(centavos)) {
      setError('Enter a valid amount in pesos.');
      return;
    }
    if (centavos <= 0) {
      setError('Enter a proposed price greater than zero.');
      return;
    }
    if (centavos > 10_000_000) {
      setError('The proposed price is too large.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Editing sends empty strings so the server can clear removed notes,
      // while a new quote omits optional fields entirely.
      const body = quote
        ? {
            proposedPrice: centavos,
            priceNotes: notes.trim(),
            estimatedDuration: duration.trim(),
          }
        : {
            proposedPrice: centavos,
            priceNotes: notes.trim() || undefined,
            estimatedDuration: duration.trim() || undefined,
          };
      if (quote) {
        await api.patch<QuoteDto>(`/quotes/${quote.id}`, body);
        toast.success('Quote updated.');
      } else {
        await api.post<QuoteDto>(`/requests/${requestId}/quotes`, body);
        toast.success('Quote sent to the customer.');
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard });
      await queryClient.invalidateQueries({ queryKey: ['provider', 'requests'] });
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send the quote.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={quote ? 'Edit your quote' : 'Send a quote'}
      description={
        quote
          ? 'You can update this quote while it is still awaiting the customer.'
          : 'Give the customer a clear price and scope. You can only send one quote per request.'
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field
          id="quote-price"
          label="Proposed price (₱)"
          required
          hint="Use the total you can commit to for the work described. Parts that may change the price should be explained below."
        >
          <Input
            id="quote-price"
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="e.g. 950"
            required
          />
        </Field>
        <Field
          id="quote-duration"
          label="Estimated duration"
          hint="For example: “1–2 hours” or “Same-day visit”."
        >
          <Input
            id="quote-duration"
            value={duration}
            maxLength={80}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="How long the work should take"
          />
        </Field>
        <Field
          id="quote-notes"
          label="What is included?"
          hint="Explain labor, parts, assumptions, and anything that would change the price."
        >
          <Textarea
            id="quote-notes"
            rows={4}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Example: includes labor and a standard replacement part; special parts need customer approval."
          />
        </Field>
        <Alert tone="info">
          Your business name, verification badges, and rating are shown with the quote. The
          customer&apos;s email stays hidden until they accept a quote. No payment is processed by
          AyosDito.
        </Alert>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {quote ? 'Save quote' : 'Send quote'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
