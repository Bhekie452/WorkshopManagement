/**
 * Customer Portal API Service
 * Token-based access for customers to view jobs, invoices, book appointments, etc.
 */

export interface PortalData {
  customer_id: string;
  expires_at?: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address?: string;
  };
  jobs: Array<{
    id: string;
    status: string;
    serviceType: string;
    description?: string;
    estimatedCost?: number;
    createdAt: string;
    dueDate: string;
    vehicleId?: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    type: 'Invoice' | 'Quote';
    status: string;
    total: number;
    dueDate: string;
    issueDate: string;
    items?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  }>;
  vehicles: Array<{
    id: string;
    registration: string;
    make: string;
    model: string;
    year: number;
    mileage?: number;
  }>;
  appointments: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    type: string;
    status: string;
    vehicleId?: string;
  }>;
}

export const portalService = {
  async getMe(token: string): Promise<PortalData> {
    const res = await fetch(`/api/portal/me?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Invalid or expired link');
    }
    return res.json();
  },

  async acceptQuote(token: string, invoiceId: string): Promise<{ success: boolean }> {
    const res = await fetch(
      `/api/portal/accept-quote?token=${encodeURIComponent(token)}&invoice_id=${encodeURIComponent(invoiceId)}`,
      { method: 'POST' }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to accept quote');
    }
    return res.json();
  },

  async bookAppointment(
    token: string,
    data: { title: string; start: string; end: string; type?: string; vehicle_id?: string }
  ): Promise<{ success: boolean; appointment: object }> {
    const params = new URLSearchParams({ token, title: data.title, start: data.start, end: data.end });
    if (data.type) params.set('type', data.type);
    if (data.vehicle_id) params.set('vehicle_id', data.vehicle_id);
    const res = await fetch(`/api/portal/book-appointment?${params}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to book appointment');
    }
    return res.json();
  },

  /** Staff only: create portal token for a customer. Requires auth token. */
  async createToken(customerId: string, snapshot: Partial<PortalData>): Promise<{ token: string; url: string }> {
    const { ApiCall } = await import('./api');
    return ApiCall.post<{ token: string; url: string }>('portal/token', {
      customer_id: customerId,
      customer: snapshot.customer,
      jobs: snapshot.jobs,
      invoices: snapshot.invoices,
      vehicles: snapshot.vehicles,
      appointments: snapshot.appointments,
    });
  },

  async getPaymentUrl(token: string, invoiceId: string): Promise<{ url: string }> {
    const res = await fetch(
      `/api/portal/payment-url?token=${encodeURIComponent(token)}&invoice_id=${encodeURIComponent(invoiceId)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to get payment link');
    }
    return res.json();
  },
};
