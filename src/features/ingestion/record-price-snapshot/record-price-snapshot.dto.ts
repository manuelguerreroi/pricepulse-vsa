import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RecordPriceSnapshotSchema = z.object({
  productId: z
    .string()
    .uuid('Valid product UUID is required')
    .describe('UUID of the tracked product'),
  newPriceMinorUnits: z
    .number()
    .int()
    .positive('Price must be a positive integer in minor units')
    .describe('New scraped price in minor units (e.g. 75000 for $75.000 CLP)'),
});

export class RecordPriceSnapshotDto extends createZodDto(RecordPriceSnapshotSchema) {}

export const RecordPriceSnapshotResponseSchema = z.object({
  snapshotId: z.string().uuid().describe('Unique UUID of the recorded snapshot'),
  productId: z.string().uuid().describe('Tracked product UUID'),
  oldPriceMinorUnits: z.number().describe('Previous price in minor units before this snapshot'),
  newPriceMinorUnits: z.number().describe('Newly recorded price in minor units'),
  currency: z.string().describe('ISO 4217 currency code'),
  isPriceDrop: z.boolean().describe('True if new price is strictly lower than old price'),
  dropPercentage: z.number().describe('Percentage of price drop (e.g. 25 for a 25% drop)'),
  recordedAt: z.string().describe('Timestamp when the snapshot was recorded in ISO-8601 UTC'),
});

export class RecordPriceSnapshotResponseDto extends createZodDto(RecordPriceSnapshotResponseSchema) {}
