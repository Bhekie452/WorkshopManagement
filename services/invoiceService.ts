export type RawInvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

const base = '/api';

export const invoiceService = {
  async listInvoiceItems(invoiceId: string) {
    const res = await fetch(`${base}/invoices/${invoiceId}/items`);
    if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`);
    const data: RawInvoiceItem[] = await res.json();
    return data.map(i => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      total: i.total
    }));
  },

  async createInvoiceItem(invoiceId: string, payload: { description: string; quantity: number; unitPrice: number }) {
    const body = { description: payload.description, quantity: payload.quantity, unit_price: payload.unitPrice };
    const res = await fetch(`${base}/invoices/${invoiceId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    return res.json();
  },

  async updateInvoiceItem(invoiceId: string, itemId: string, payload: { description?: string; quantity?: number; unitPrice?: number }) {
    const body: any = {};
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.quantity !== undefined) body.quantity = payload.quantity;
    if (payload.unitPrice !== undefined) body.unit_price = payload.unitPrice;
    const res = await fetch(`${base}/invoices/${invoiceId}/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    return res.json();
  },

  async deleteInvoiceItem(invoiceId: string, itemId: string) {
    const res = await fetch(`${base}/invoices/${invoiceId}/items/${itemId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    return true;
  }
};
