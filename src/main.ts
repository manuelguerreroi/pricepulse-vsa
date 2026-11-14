import * as dotenv from 'dotenv';
dotenv.config({ path: 'env.example' });

import { otelSdk } from './shared/infra/observability/telemetry';

// 1. Initialize OpenTelemetry before application bootstrap
otelSdk.start();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';

// Patch @nestjs/swagger to support nestjs-zod DTO schemas and reflection
patchNestJsSwagger();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 2. Enable Graceful Shutdown Hooks
  app.enableShutdownHooks();

  // 3. Global Zod Validation Pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // 4. Conditional Swagger Documentation
  const isSwaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
  if (isSwaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('PricePulse API')
      .setDescription(
        'E-commerce price monitoring engine built with Vertical Slice Architecture, NestJS, Drizzle ORM, NATS JetStream, and OpenTelemetry.',
      )
      .setVersion('1.0.0')
      .addTag('Health', 'Liveness and infrastructure readiness probes')
      .addTag('Catalog', 'Tracked product registration and catalog management')
      .addTag('Alerts', 'User price drop alert subscriptions')
      .addTag('Ingestion', 'Price snapshot recording and variation detection')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // 5. Start Server
  const port = process.env.PORT || 3333;
  await app.listen(port);

  logger.log(`PricePulse API is running on http://localhost:${port}`);
  if (isSwaggerEnabled) {
    logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
  }
}

// Handle unexpected errors during bootstrap
bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
