import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ScrapeJobDataSchema = z.object({
  productId: z.string().uuid(),
  url: z.string().url(),
  domain: z.string(),
});

export class ScrapeJobDataDto extends createZodDto(ScrapeJobDataSchema) {}
