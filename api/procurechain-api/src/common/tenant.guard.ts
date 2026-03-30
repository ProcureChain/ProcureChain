import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const tenantId = req.headers['x-tenant-id'];
    const companyId = req.headers['x-company-id'];

    if (!tenantId || !companyId) {
      throw new UnauthorizedException(
        'Missing required headers: x-tenant-id and x-company-id',
      );
    }

    const tId = String(tenantId);
    const cId = String(companyId);
    const userId = req.header('x-user-id') ?? req.ctx?.userId ?? 'dev-user';
    const rolesHeader = req.header('x-user-roles');
    const roles = Array.isArray(req.ctx?.roles)
      ? req.ctx.roles
      : (rolesHeader ?? 'PROCUREMENT_OFFICER')
          .split(',')
          .map((r: string) => r.trim())
          .filter(Boolean);

    const company = await this.prisma.company.findFirst({
      where: { id: cId, tenantId: tId },
      select: { id: true, tenantId: true },
    });

    if (!company) {
      throw new ForbiddenException('Invalid tenant/company scope');
    }

    req.ctx = {
      ...req.ctx,
      tenantId: tId,
      companyId: cId,
      userId,
      roles,
      actorType: req.ctx?.actorType ?? 'INTERNAL',
      partnerId: req.ctx?.partnerId,
      partnerUserId: req.ctx?.partnerUserId,
    };
    return true;
  }
}
