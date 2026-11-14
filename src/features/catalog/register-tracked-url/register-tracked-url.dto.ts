import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RegisterTrackedUrlSchema = z.object({
  url: z
    .string()
    .url('A valid URL is required')
    .describe('E-commerce product URL to track (e.g. MercadoLibre, Amazon)'),
});

export class RegisterTrackedUrlDto extends createZodDto(RegisterTrackedUrlSchema) {}

export const TrackedProductResponseSchema = z.object({
  id: z.string().uuid().describe('Unique UUID of the tracked product'),
  url: z.string().describe('Normalized e-commerce product URL'),
  domain: z.string().describe('Domain extracted from URL (e.g. mercadolibre.cl)'),
  title: z.string().describe('Scraped product title'),
  currentPriceMinorUnits: z.number().describe('Current product price in minor units (cents or CLP pesos)'),
  currency: z.string().describe('ISO 4217 currency code (CLP, USD)'),
  status: z.string().describe('Product tracking status (ACTIVE, OUT_OF_STOCK, INACTIVE)'),
  createdAt: z.string().describe('Creation timestamp in ISO-8601 UTC'),
});

export class TrackedProductResponseDto extends createZodDto(TrackedProductResponseSchema) {}
