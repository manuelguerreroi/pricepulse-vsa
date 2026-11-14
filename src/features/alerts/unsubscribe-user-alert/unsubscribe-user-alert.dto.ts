import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UnsubscribeUserAlertQuerySchema = z.object({
  alertId: z.string().uuid('Valid alert UUID is required'),
});

export class UnsubscribeUserAlertQueryDto extends createZodDto(UnsubscribeUserAlertQuerySchema) {}

export const UnsubscribeResponseSchema = z.object({
  success: z.boolean(),
  alertId: z.string().uuid(),
  message: z.string(),
});

export class UnsubscribeResponseDto extends createZodDto(UnsubscribeResponseSchema) {}
