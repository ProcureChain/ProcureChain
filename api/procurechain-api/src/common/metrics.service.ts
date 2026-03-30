import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDurationSeconds: Histogram<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'procurechain_' });

    this.httpRequestsTotal = new Counter({
      name: 'procurechain_http_requests_total',
      help: 'Total HTTP requests handled by the ProcureChain API',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'procurechain_http_request_duration_seconds',
      help: 'HTTP request duration in seconds for the ProcureChain API',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  recordHttpRequest(params: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }) {
    const labels = {
      method: params.method,
      route: params.route,
      status_code: String(params.statusCode),
    };

    this.httpRequestsTotal.inc(labels, 1);
    this.httpRequestDurationSeconds.observe(labels, params.durationSeconds);
  }

  getContentType() {
    return this.registry.contentType;
  }

  async getMetrics() {
    return this.registry.metrics();
  }
}
