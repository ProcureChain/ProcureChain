export type RequestContext = {
  tenantId: string;
  companyId: string;
  userId?: string;
  roles?: string[];
  actorType?: 'INTERNAL' | 'PARTNER';
  partnerId?: string;
  partnerUserId?: string;
};
