import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerAccessScope } from '@prisma/client';

@Injectable()
export class PartnerAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private rank(scope: PartnerAccessScope) {
    switch (scope) {
      case 'READ_ONLY': return 1;
      case 'SUPPORT': return 2;
      case 'IMPLEMENTATION': return 3;
      default: return 0;
    }
  }

  async requireTenantAccess(params: {
    partnerId: string;
    tenantId: string;
    minScope?: PartnerAccessScope;
  }) {
    const { partnerId, tenantId, minScope = 'READ_ONLY' } = params;

    const access = await this.prisma.tenantPartnerAccess.findUnique({
      where: { tenantId_partnerId: { tenantId, partnerId } },
      select: { isActive: true, scope: true, startsAt: true, endsAt: true },
    });

    if (!access || !access.isActive) {
      throw new ForbiddenException('Partner has no access to this tenant');
    }

    const now = new Date();
    if (access.startsAt && now < access.startsAt) {
      throw new ForbiddenException('Partner access not active yet');
    }
    if (access.endsAt && now > access.endsAt) {
      throw new ForbiddenException('Partner access expired');
    }

    if (this.rank(access.scope) < this.rank(minScope)) {
      throw new ForbiddenException('Partner scope insufficient');
    }

    return access;
  }
}
