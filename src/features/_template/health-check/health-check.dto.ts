import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LivenessResponseSchema = z.object({
  status: z.literal('alive'),
  timestamp: z.string(),
});

export class LivenessResponseDto extends createZodDto(LivenessResponseSchema) {}

export const ReadinessCheckStatusSchema = z.enum(['ok', 'unhealthy']);

export const ReadinessResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  timestamp: z.string(),
  checks: z.object({
    postgres: ReadinessCheckStatusSchema,
    valkey: ReadinessCheckStatusSchema,
    nats: ReadinessCheckStatusSchema,
  }),
});

export class ReadinessResponseDto extends createZodDto(ReadinessResponseSchema) {}
