import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class ActorContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const tenantId = req.header('x-tenant-id') ?? undefined;
    const companyId = req.header('x-company-id') ?? undefined;

    const partnerId = req.header('x-partner-id') ?? undefined;
    const partnerUserId = req.header('x-partner-user-id') ?? undefined;

    // attach a single ctx object used everywhere
    (req as any).ctx = {
      tenantId,
      companyId,
      actorType: partnerId ? 'PARTNER' : 'INTERNAL',
      partnerId,
      partnerUserId,
    };

    next();
  }
}
