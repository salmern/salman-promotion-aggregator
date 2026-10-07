'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { BrandWithCount } from '@promotions/shared';

export function useBrands() {
  const [brands, setBrands] = useState<BrandWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.brands.list()
      .then((r) => setBrands(r.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load brands'))
      .finally(() => setLoading(false));
  }, []);

  return { brands, loading, error };
}
