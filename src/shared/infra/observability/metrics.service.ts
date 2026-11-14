import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry: Registry;

  // Custom HTTP metrics
  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;

  // Business and resilience metrics
  readonly priceDropEventsTotal: Counter<string>;
  readonly notificationsDispatchedTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // 1. Default Node.js system and process metrics
    collectDefaultMetrics({ register: this.registry, prefix: 'pricepulse_' });

    // 2. HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'pricepulse_http_requests_total',
      help: 'Total number of HTTP requests processed',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'pricepulse_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    // 3. Domain metrics
    this.priceDropEventsTotal = new Counter({
      name: 'pricepulse_price_drops_total',
      help: 'Total number of price drops detected and recorded',
      registers: [this.registry],
    });

    this.notificationsDispatchedTotal = new Counter({
      name: 'pricepulse_notifications_dispatched_total',
      help: 'Total number of notification emails dispatched to users',
      registers: [this.registry],
    });
  }

  onApplicationBootstrap() {
    this.logger.log('Prometheus MetricsService initialized and collecting default metrics.');
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
