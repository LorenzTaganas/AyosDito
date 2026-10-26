import { z } from 'zod';

// ---------------------------------------------------------------------------
// Domain vocabulary
// ---------------------------------------------------------------------------

export const ROLES = ['CUSTOMER', 'PROVIDER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const PROVIDER_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ProviderApprovalStatus = (typeof PROVIDER_APPROVAL_STATUSES)[number];

export const VERIFICATION_STATUSES = ['UNVERIFIED', 'IDENTITY_VERIFIED', 'BUSINESS_VERIFIED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_TYPES = ['IDENTITY', 'BUSINESS'] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

export const VERIFICATION_REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type VerificationReviewStatus = (typeof VERIFICATION_REVIEW_STATUSES)[number];

export const REQUEST_STATUSES = [
  'PENDING',
  'RESPONDED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'DECLINED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const QUOTE_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const REVIEW_MODERATION_STATUSES = ['VISIBLE', 'HIDDEN'] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export const REPORT_ENTITY_TYPES = ['PROVIDER', 'REVIEW'] as const;
export type ReportEntityType = (typeof REPORT_ENTITY_TYPES)[number];

export const REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_REASONS = ['SCAM_OR_FRAUD', 'ABUSIVE_CONTENT', 'MISLEADING_INFO', 'SPAM', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const PRICE_TYPES = ['STARTING_FROM', 'ESTIMATE', 'FIXED'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const LOCATION_TYPES = ['REGION', 'PROVINCE', 'CITY', 'BARANGAY'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

// Monetary values are INTEGER CENTAVOS everywhere in the API and database.
// The UI converts to pesos only for display and input.
export const MAX_PRICE_CENTAVOS = 10_000_000; // PHP 100,000
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_UPLOAD_MB = 5;

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Waiting for quotes',
  RESPONDED: 'Quotes received',
  ACCEPTED: 'Quote accepted',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DECLINED: 'Closed — quotes declined',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  PENDING: 'Awaiting customer',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SCAM_OR_FRAUD: 'Scam or fraud',
  ABUSIVE_CONTENT: 'Abusive content',
  MISLEADING_INFO: 'Misleading information',
  SPAM: 'Spam',
  OTHER: 'Something else',
};

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  IDENTITY: 'Identity check',
  BUSINESS: 'Business verification',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const trimmedString = (min: number, max: number, message?: string) =>
  z
    .string({ required_error: message ?? 'This field is required.' })
    .trim()
    .min(min, message ?? `Must be at least ${min} characters.`)
    .max(max, `Must be at most ${max} characters.`);

const optionalQueryText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalQueryInt = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(min).max(max).optional(),
  );

export const emailSchema = z
  .string({ required_error: 'Email is required.' })
  .trim()
  .min(1, 'Email is required.')
  .max(254, 'Email is too long.')
  .email('Enter a valid email address.')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string({ required_error: 'Password is required.' })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`)
  .regex(/[A-Za-z]/, 'Password must include a letter.')
  .regex(/\d/, 'Password must include a number.');

export const fullNameSchema = trimmedString(2, 80, 'Enter your full name.');

export const priceSchema = z
  .number({ required_error: 'Enter an amount.', invalid_type_error: 'Enter a valid amount.' })
  .int('Amount must be a whole number of centavos.')
  .min(0, 'Amount cannot be negative.')
  .max(MAX_PRICE_CENTAVOS, 'Amount is too large.');

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(['CUSTOMER', 'PROVIDER'], {
      required_error: 'Choose an account type.',
      invalid_type_error: 'Choose a valid account type.',
    }),
    businessName: z.string().trim().min(2, 'Enter your business or display name.').max(80).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'PROVIDER' && !value.businessName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['businessName'],
        message: 'Enter the name customers will see.',
      });
    }
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(MAX_PASSWORD_LENGTH),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'This reset link is invalid.').max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(20, 'This verification link is invalid.').max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(MAX_PASSWORD_LENGTH),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Choose a different password.',
  });

export const profileUpdateSchema = z.object({
  fullName: fullNameSchema,
});

export const customerProfileUpdateSchema = z.object({
  fullName: fullNameSchema.optional(),
  preferredLocationId: z.string().trim().min(1).max(40).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Provider profile and services
// ---------------------------------------------------------------------------

export const providerProfileUpdateSchema = z.object({
  businessName: trimmedString(2, 80, 'Enter your business or display name.'),
  description: z.string().trim().max(2000).optional(),
  yearsOfExperience: z
    .number({ invalid_type_error: 'Enter a whole number of years.' })
    .int('Use a whole number.')
    .min(0, 'Years of experience cannot be negative.')
    .max(80, 'Please enter a realistic value.')
    .nullable()
    .optional(),
});

const serviceBaseSchema = z.object({
  categoryId: z.string().trim().min(1, 'Choose a category.').max(40),
  title: trimmedString(3, 100, 'Enter a short service title.'),
  description: z.string().trim().max(2000).optional(),
  startingPrice: priceSchema,
  diagnosticFee: priceSchema.nullable().optional(),
  priceType: z.enum(PRICE_TYPES),
  requiresInspection: z.boolean(),
  isActive: z.boolean(),
});

export const serviceInputSchema = serviceBaseSchema.extend({
  priceType: z.enum(PRICE_TYPES).default('STARTING_FROM'),
  requiresInspection: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const servicePatchSchema = serviceBaseSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Provide at least one field to update.',
);

export const serviceAreasSchema = z.object({
  locationIds: z
    .array(z.string().trim().min(1).max(40))
    .max(30, 'You can select up to 30 service areas.')
    .refine((ids) => new Set(ids).size === ids.length, 'Remove duplicate service areas.'),
});

export const portfolioCaptionSchema = z.object({
  caption: z.string().trim().max(140).optional(),
});

export const providerVerificationInputSchema = z.object({
  verificationType: z.enum(VERIFICATION_TYPES),
  note: trimmedString(20, 1000, 'Describe the documents or details you can present for checking.'),
});

export const reviewResponseSchema = z.object({
  response: trimmedString(10, 1000, 'Write a response of at least 10 characters.'),
});

export const verificationReviewSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reviewNote: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'REJECTED' && !value.reviewNote) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reviewNote'], message: 'Explain why the request was rejected.' });
    }
  });

// ---------------------------------------------------------------------------
// Requests, quotes, reviews, reports
// ---------------------------------------------------------------------------

export const requestCreateSchema = z.object({
  categoryId: z.string().trim().min(1, 'Choose a service category.').max(40),
  title: trimmedString(5, 100, 'Describe the problem briefly.'),
  problemDescription: trimmedString(20, 2000, 'Describe the problem in at least 20 characters.'),
  locationId: z.string().trim().min(1, 'Choose your location.').max(40),
  preferredSchedule: z.string().trim().max(120).optional(),
  targetProviderId: z.string().trim().min(1).max(40).optional(),
});

export const quoteCreateSchema = z.object({
  proposedPrice: priceSchema.refine((value) => value > 0, 'Enter a proposed price.'),
  priceNotes: z.string().trim().max(500).optional(),
  estimatedDuration: z.string().trim().max(80).optional(),
});

export const quotePatchSchema = z
  .object({
    proposedPrice: priceSchema.refine((value) => value > 0, 'Enter a proposed price.').optional(),
    priceNotes: z.string().trim().max(500).optional(),
    estimatedDuration: z.string().trim().max(80).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const reviewCreateSchema = z.object({
  rating: z.number({ required_error: 'Choose a rating.' }).int().min(1).max(5),
  comment: z.string().trim().max(1000, 'Keep your review under 1000 characters.').optional(),
});

export const reportCreateSchema = z.object({
  entityType: z.enum(REPORT_ENTITY_TYPES),
  entityId: z.string().trim().min(1).max(40),
  reason: z.enum(REPORT_REASONS),
  description: trimmedString(10, 1000, 'Give a short explanation (at least 10 characters).'),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const providerApprovalSchema = z
  .object({
    approvalStatus: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.approvalStatus === 'REJECTED' && !value.reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Give the provider a reason.' });
    }
  });

export const userStatusSchema = z
  .object({
    accountStatus: z.enum(ACCOUNT_STATUSES),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.accountStatus === 'SUSPENDED' && (!value.reason || value.reason.trim().length < 3)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Explain the suspension reason.' });
    }
  });

export const grantAdminSchema = z.object({
  role: z.literal('ADMIN'),
});

export const reviewModerationSchema = z
  .object({
    moderationStatus: z.enum(REVIEW_MODERATION_STATUSES),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.moderationStatus === 'HIDDEN' && !value.reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Give a moderation reason.' });
    }
  });

export const reportUpdateSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionNote: trimmedString(3, 500, 'Add a short resolution note.'),
});

const categoryBaseSchema = z.object({
  name: trimmedString(2, 60, 'Enter a category name.'),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().min(1).max(40),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

export const categoryInputSchema = categoryBaseSchema.extend({
  icon: z.string().trim().min(1).max(40).default('wrench'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const categoryPatchSchema = categoryBaseSchema.partial();

const locationBaseSchema = z.object({
  name: trimmedString(2, 80, 'Enter a location name.'),
  locationType: z.enum(LOCATION_TYPES),
  parentId: z.string().trim().min(1).max(40).nullable().optional(),
  isActive: z.boolean(),
});

export const locationInputSchema = locationBaseSchema.extend({
  isActive: z.boolean().default(true),
});

export const locationPatchSchema = locationBaseSchema.partial();

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const providerSearchSchema = z
  .object({
    q: optionalQueryText(100),
    category: optionalQueryText(80),
    locationId: optionalQueryText(40),
    minPrice: optionalQueryInt(0, MAX_PRICE_CENTAVOS),
    maxPrice: optionalQueryInt(0, MAX_PRICE_CENTAVOS),
    minRating: optionalQueryInt(1, 5),
    verified: z.enum(['any', 'identity', 'business']).optional(),
    sort: z.enum(['recommended', 'rating', 'price_asc', 'price_desc', 'newest']).default('recommended'),
    page: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().min(1).default(1),
    ),
    pageSize: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().min(1).max(24).default(12),
    ),
  })
  .refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
    path: ['maxPrice'],
    message: 'Maximum price must be higher than the minimum.',
  });

export type ProviderSearchInput = z.infer<typeof providerSearchSchema>;

export const paginationQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(1).default(1),
  ),
  pageSize: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(1).max(50).default(20),
  ),
});

export const adminListQuerySchema = paginationQuerySchema.extend({
  q: optionalQueryText(100),
  status: optionalQueryText(40),
  role: optionalQueryText(20),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProviderProfileUpdateInput = z.infer<typeof providerProfileUpdateSchema>;
export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type ServicePatchInput = z.infer<typeof servicePatchSchema>;
export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>;
export type QuotePatchInput = z.infer<typeof quotePatchSchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type LocationInput = z.infer<typeof locationInputSchema>;
