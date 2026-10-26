import type { Prisma } from '@prisma/client';

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

export async function writeAudit(
  client: AuditClient,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
