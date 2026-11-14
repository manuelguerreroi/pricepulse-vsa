import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateUserAlertSchema = z.object({
  userEmail: z.string().email('Valid email address is required'),
  productId: z.string().uuid('Valid product UUID is required'),
  targetPriceMinorUnits: z.number().int().positive('Target price must be a positive integer in minor units'),
});

export class CreateUserAlertDto extends createZodDto(CreateUserAlertSchema) {}

export const UserAlertResponseSchema = z.object({
  id: z.string().uuid(),
  userEmail: z.string().email(),
  productId: z.string().uuid(),
  targetPriceMinorUnits: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export class UserAlertResponseDto extends createZodDto(UserAlertResponseSchema) {}
