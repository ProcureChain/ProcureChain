import { AdapterInvoiceSnapshot, AdapterSyncParams, ERPAdapter } from './erp.adapter';

/**
 * Sprint 3 baseline adapter stub.
 * Replace with real QuickBooks integration in later sprints.
 */
export class QuickBooksAdapter implements ERPAdapter {
  system: 'QUICKBOOKS' = 'QUICKBOOKS';

  async fetchInvoiceSnapshots(_params: AdapterSyncParams): Promise<AdapterInvoiceSnapshot[]> {
    return [];
  }
}
