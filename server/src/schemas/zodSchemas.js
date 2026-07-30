import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID.');
const email = z.string().trim().email('Invalid email address.').max(254);
const promoCode = z.string().trim().min(1).max(32).regex(/^[A-Z0-9_-]+$/i, 'Invalid promo code.');

const toDigits = (value) => String(value || '').replace(/\D/g, '');

const phone = z
  .string({ required_error: 'Phone number must be exactly 10 digits.' })
  .trim()
  .transform(toDigits)
  .refine((v) => /^\d{10}$/.test(v), { message: 'Phone number must be exactly 10 digits.' });

const phoneOptional = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => toDigits(v || ''))
  .refine((v) => v === '' || /^\d{10}$/.test(v), {
    message: 'Phone number must be exactly 10 digits.',
  })
  .optional()
  .transform((v) => (v === '' || v == null ? undefined : v));

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password: z.string().min(8).max(128),
  phone: phoneOptional,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const orderCreateSchema = z.object({
  packageId: objectId,
  phone,
  email,
  quantity: z.coerce.number().int().min(1).max(5).optional().default(1),
  promoCode: promoCode.optional(),
  afaDetails: z
    .object({
      fullName: z.string().trim().min(3).max(120),
      ghanaCard: z.string().trim().regex(/^GHA-\d{9}-\d$/, 'Invalid Ghana Card format.'),
      location: z.string().trim().min(2).max(120),
    })
    .optional(),
});

export const orderValidateSchema = orderCreateSchema;

export const paymentReferenceSchema = z.object({
  reference: z.string().trim().min(5).max(64).regex(/^[A-Z0-9_-]+$/i),
});

export const otpRequestSchema = z.object({ email });

export const otpVerifySchema = z.object({
  email,
  otp: z.string().trim().min(4).max(8),
});

export const adminLoginVerifySchema = z.object({
  pendingToken: z.string().trim().min(1),
  otp: z.string().trim().min(4).max(8),
});

export const adminLoginResendSchema = z.object({
  pendingToken: z.string().trim().min(1),
});

const orderStatusEnum = z.enum([
  'pending',
  'processing',
  'verification',
  'delivered',
  'failed',
  'refunded',
  'cancelled',
]);
const paymentStatusEnum = z.enum(['pending', 'paid', 'failed', 'refunded']);

export const orderStatusUpdateSchema = z
  .object({
    status: orderStatusEnum.optional(),
    deliveryStatus: orderStatusEnum.optional(),
    paymentStatus: paymentStatusEnum.optional(),
  })
  .refine((data) => data.status || data.deliveryStatus || data.paymentStatus, {
    message: 'A status value is required.',
  });

export const orderBulkStatusUpdateSchema = z
  .object({
    orderIds: z.array(z.string().min(1)).min(1).max(100),
    deliveryStatus: orderStatusEnum.optional(),
    paymentStatus: paymentStatusEnum.optional(),
  })
  .refine((data) => data.deliveryStatus || data.paymentStatus, {
    message: 'A status value is required.',
  });

export const promoBulkSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).optional(),
  discountType: z.enum(['free', 'percentage', 'fixed']).optional(),
  discountValue: z.coerce.number().positive(),
  expiryDate: z.string().min(1),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  productCategories: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const packageBreakdownSchema = z.object({
  promoCode: promoCode.optional(),
  email: email.optional(),
  phone: phoneOptional,
});
