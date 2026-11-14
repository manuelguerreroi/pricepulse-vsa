import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateUserAlertSchema = z.object({
  userEmail: z
    .string()
    .email('Valid email address is required')
    .describe('User email address for price drop alerts'),
  productId: z
    .string()
    .uuid('Valid product UUID is required')
    .describe('UUID of the tracked product to monitor'),
  targetPriceMinorUnits: z
    .number()
    .int()
    .positive('Target price must be a positive integer in minor units')
    .describe('Target alert threshold in minor units (e.g. 80000 for $80.000 CLP)'),
});

export class CreateUserAlertDto extends createZodDto(CreateUserAlertSchema) {}

export const UserAlertResponseSchema = z.object({
  id: z.string().uuid().describe('Unique UUID of the created alert'),
  userEmail: z.string().email().describe('Subscribed user email address'),
  productId: z.string().uuid().describe('Target tracked product UUID'),
  targetPriceMinorUnits: z.number().describe('Target alert price threshold in minor units'),
  isActive: z.boolean().describe('Whether the alert is currently active'),
  createdAt: z.string().describe('Creation timestamp in ISO-8601 UTC'),
});

export class UserAlertResponseDto extends createZodDto(UserAlertResponseSchema) {}
