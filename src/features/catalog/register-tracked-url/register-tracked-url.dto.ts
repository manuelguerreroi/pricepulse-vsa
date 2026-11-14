import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RegisterTrackedUrlSchema = z.object({
  url: z.string().url('A valid URL is required'),
});

export class RegisterTrackedUrlDto extends createZodDto(RegisterTrackedUrlSchema) {}

export const TrackedProductResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  domain: z.string(),
  title: z.string(),
  currentPriceMinorUnits: z.number(),
  currency: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export class TrackedProductResponseDto extends createZodDto(TrackedProductResponseSchema) {}
