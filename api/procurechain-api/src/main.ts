import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/request-id.middleware';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { MetricsService } from './common/metrics.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const metricsService = app.get(MetricsService);

  // CORS (dev/staging)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.use((req: Request & { ctx?: any }, _res: Response, next: NextFunction) => {
    if (req.path === '/metrics') {
      return next();
    }

    const tenantId = req.header('x-tenant-id');
    const companyId = req.header('x-company-id');
    const userId = req.header('x-user-id') ?? 'dev-user';
    const roles = (req.header('x-user-roles') ?? 'PROCUREMENT_OFFICER')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    const partnerId = req.header('x-partner-id') ?? undefined;
    const partnerUserId = req.header('x-partner-user-id') ?? undefined;

    if (!tenantId || !companyId) {
      throw new BadRequestException('x-tenant-id and x-company-id are required');
    }

    req.ctx = {
      tenantId,
      companyId,
      userId,
      roles,
      actorType: partnerId ? 'PARTNER' : 'INTERNAL',
      partnerId,
      partnerUserId,
    };
    next();
  });

  // Request ID middleware (MUST be after app is created)
  app.use(requestIdMiddleware);

  // Simple request logging with correlation ID
  app.use((req: any, res: Response, next) => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationSeconds =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const routePath =
        (req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path) ||
        'unknown';

      metricsService.recordHttpRequest({
        method: req.method,
        route: routePath,
        statusCode: res.statusCode,
        durationSeconds,
      });
    });

    console.log(
      `[${req.requestId}] ${req.method} ${req.originalUrl}`,
    );
    next();
  });

  const port = Number(process.env.PORT || 8080);
  await app.listen(port, '0.0.0.0');

  console.log(
    `ProcureChain API listening on http://0.0.0.0:${port} (${process.env.ENV_NAME || 'dev'})`,
  );
}

bootstrap();
