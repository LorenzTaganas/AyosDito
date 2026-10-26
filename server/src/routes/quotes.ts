import { Router } from 'express';
import { quotePatchSchema } from '../../../shared/contracts';
import type { ServiceRequestDetail } from '../../../shared/api-types';
import { ApiError, asyncHandler, forbidden, notFound, parseBody, parseId } from '../lib/http';
import { requestDetailInclude, toQuote, toRequestDetail } from '../lib/serialize';
import { currentProvider, currentUser, requireAuth, requireRole } from '../middleware/session';
import { writeLimiter } from '../middleware/rateLimit';
import { prisma } from '../prisma';

export const quotesRouter = Router();

quotesRouter.use(requireAuth);
quotesRouter.use(writeLimiter);

async function detailForCustomer(requestId: string, customerId: string): Promise<ServiceRequestDetail> {
  const row = await prisma.serviceRequest.findUnique({ where: { id: requestId }, include: requestDetailInclude });
  if (!row || row.customerId !== customerId) throw notFound('Request not found.');
  return toRequestDetail(row, {
    userId: customerId,
    role: 'CUSTOMER',
    providerId: null,
    providerCanQuote: false,
  });
}

quotesRouter.patch(
  '/:id',
  requireRole('PROVIDER'),
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const quoteId = parseId(req.params.id, 'quote');
    if (provider.approvalStatus !== 'APPROVED') {
      throw forbidden('Only approved providers can update quotes.');
    }
    const input = parseBody(quotePatchSchema, req.body);

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, providerId: provider.id },
      include: { serviceRequest: { select: { status: true } } },
    });
    if (!quote) throw notFound('Quote not found.');
    if (quote.status !== 'PENDING') {
      throw new ApiError(409, 'QUOTE_CLOSED', 'Only quotes awaiting the customer can be edited.');
    }
    if (!['PENDING', 'RESPONDED'].includes(quote.serviceRequest.status)) {
      throw new ApiError(409, 'REQUEST_CLOSED', 'This request is no longer accepting quote updates.');
    }

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        ...(input.proposedPrice !== undefined ? { proposedPrice: input.proposedPrice } : {}),
        ...(input.priceNotes !== undefined ? { priceNotes: input.priceNotes || null } : {}),
        ...(input.estimatedDuration !== undefined ? { estimatedDuration: input.estimatedDuration || null } : {}),
      },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            profileImage: true,
            identityVerifiedAt: true,
            businessVerifiedAt: true,
            isDemo: true,
            ratingAvg: true,
            reviewCount: true,
          },
        },
      },
    });

    res.json({ data: toQuote(updated) });
  }),
);

quotesRouter.post(
  '/:id/accept',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const quoteId = parseId(req.params.id, 'quote');

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        status: true,
        serviceRequestId: true,
        providerId: true,
        serviceRequest: { select: { customerId: true, status: true } },
      },
    });
    if (!quote || quote.serviceRequest.customerId !== user.id) throw notFound('Quote not found.');
    if (quote.status !== 'PENDING') {
      throw new ApiError(409, 'QUOTE_CLOSED', 'This quote is no longer awaiting your decision.');
    }
    if (quote.serviceRequest.status !== 'RESPONDED') {
      throw new ApiError(409, 'INVALID_TRANSITION', 'Only a request with open quotes can be accepted.');
    }

    await prisma.$transaction(async (tx) => {
      const accepted = await tx.quote.updateMany({
        where: { id: quote.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (accepted.count === 0) {
        throw new ApiError(409, 'QUOTE_CLOSED', 'This quote was already handled.');
      }
      await tx.quote.updateMany({
        where: {
          serviceRequestId: quote.serviceRequestId,
          id: { not: quote.id },
          status: 'PENDING',
        },
        data: { status: 'DECLINED' },
      });
      await tx.serviceRequest.updateMany({
        where: { id: quote.serviceRequestId, status: 'RESPONDED' },
        data: { status: 'ACCEPTED', assignedProviderId: quote.providerId },
      });
    });

    res.json({ data: await detailForCustomer(quote.serviceRequestId, user.id) });
  }),
);

quotesRouter.post(
  '/:id/decline',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const quoteId = parseId(req.params.id, 'quote');

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        status: true,
        serviceRequestId: true,
        serviceRequest: { select: { customerId: true, status: true } },
      },
    });
    if (!quote || quote.serviceRequest.customerId !== user.id) throw notFound('Quote not found.');
    if (quote.status !== 'PENDING') {
      throw new ApiError(409, 'QUOTE_CLOSED', 'This quote is no longer awaiting your decision.');
    }
    if (quote.serviceRequest.status !== 'RESPONDED') {
      throw new ApiError(409, 'INVALID_TRANSITION', 'Only a request with open quotes can be updated.');
    }

    await prisma.$transaction(async (tx) => {
      const declined = await tx.quote.updateMany({
        where: { id: quote.id, status: 'PENDING' },
        data: { status: 'DECLINED' },
      });
      if (declined.count === 0) {
        throw new ApiError(409, 'QUOTE_CLOSED', 'This quote was already handled.');
      }
      const remaining = await tx.quote.count({
        where: { serviceRequestId: quote.serviceRequestId, status: 'PENDING' },
      });
      if (remaining === 0) {
        await tx.serviceRequest.updateMany({
          where: { id: quote.serviceRequestId, status: 'RESPONDED' },
          data: { status: 'DECLINED' },
        });
      }
    });

    res.json({ data: await detailForCustomer(quote.serviceRequestId, user.id) });
  }),
);
