import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RecordPriceSnapshotSchema = z.object({
  productId: z.string().uuid('Valid product UUID is required'),
  newPriceMinorUnits: z.number().int().positive('Price must be a positive integer in minor units'),
});

export class RecordPriceSnapshotDto extends createZodDto(RecordPriceSnapshotSchema) {}

export const RecordPriceSnapshotResponseSchema = z.object({
  snapshotId: z.string().uuid(),
  productId: z.string().uuid(),
  oldPriceMinorUnits: z.number(),
  newPriceMinorUnits: z.number(),
  currency: z.string(),
  isPriceDrop: z.boolean(),
  dropPercentage: z.number(),
  recordedAt: z.string(),
});

export class RecordPriceSnapshotResponseDto extends createZodDto(RecordPriceSnapshotResponseSchema) {}
