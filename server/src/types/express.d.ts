import type { CustomerProfile, ProviderProfile, User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      auth: {
        user: User & {
          providerProfile: ProviderProfile | null;
          customerProfile: CustomerProfile | null;
        };
        sessionId: string;
      } | null;
    }
  }
}

export {};
