/**
 * Typed API client for the Promotions Aggregator backend.
 * All types are imported from @promotions/shared.
 */
import type {
  Promotion,
  Brand,
  BrandWithCount,
  PaginatedResponse,
  ScrapeJobStatus,
  EnqueueScrapeResponse,
  VerificationReport,
} from '@promotions/shared';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Only set Content-Type: application/json when we actually have a body.
  // Sending it with an empty body causes Fastify to return 400 FST_ERR_CTP_EMPTY_JSON_BODY.
  const hasBody = options?.body != null;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface PromotionsQuery {
  search?: string;
  startDate?: string;
  endDate?: string;
  brand?: string;
  page?: number;
  pageSize?: number;
}

export interface PromotionsResponse {
  items: Promotion[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  meta: { timezone: 'America/Denver' };
}

export interface BrandsResponse {
  items: BrandWithCount[];
  total: number;
}

export const api = {
  promotions: {
    list: (query: PromotionsQuery = {}): Promise<PromotionsResponse> => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.startDate) params.set('startDate', query.startDate);
      if (query.endDate) params.set('endDate', query.endDate);
      if (query.brand) params.set('brand', query.brand);
      if (query.page) params.set('page', String(query.page));
      if (query.pageSize) params.set('pageSize', String(query.pageSize));
      const qs = params.toString();
      return request<PromotionsResponse>(`/promotions${qs ? `?${qs}` : ''}`);
    },
    get: (id: number): Promise<Promotion> => request<Promotion>(`/promotions/${id}`),
  },

  brands: {
    list: (): Promise<BrandsResponse> => request<BrandsResponse>('/brands'),
  },

  scrape: {
    start: (): Promise<EnqueueScrapeResponse> =>
      request<EnqueueScrapeResponse>('/scrape', { method: 'POST' }),
    status: (jobId: string): Promise<ScrapeJobStatus> =>
      request<ScrapeJobStatus>(`/scrape/${jobId}`),
    cancel: (jobId: string): Promise<{ jobId: string; message: string }> =>
      request(`/scrape/${jobId}/cancel`, { method: 'POST' }),
  },

  verify: {
    start: (): Promise<{ runId: number; jobId: string; message: string }> =>
      request('/verify', { method: 'POST' }),
    report: (runId: number): Promise<VerificationReport> =>
      request<VerificationReport>(`/verify/${runId}`),
  },
};
