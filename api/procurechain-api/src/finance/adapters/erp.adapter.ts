export type AdapterInvoiceSnapshot = {
  externalInvoiceId: string;
  invoiceNumber?: string;
  poId?: string;
  poNumber?: string;
  currency?: string;
  totalAmount: number;
  invoiceDate?: string;
  status?: string;
  rawPayload?: unknown;
};

export type AdapterSyncParams = {
  tenantId: string;
  companyId: string;
  since?: string;
};

export interface ERPAdapter {
  system: 'ERP' | 'QUICKBOOKS';
  fetchInvoiceSnapshots(params: AdapterSyncParams): Promise<AdapterInvoiceSnapshot[]>;
}
