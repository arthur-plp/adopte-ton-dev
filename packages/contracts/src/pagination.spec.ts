import { PaginationQuerySchema, paginatedResponse } from './pagination';
import { z } from 'zod';

describe('PaginationQuerySchema', () => {
  it('applique les valeurs par défaut (page=1, pageSize=20)', () => {
    const result = PaginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it('parse des chaînes en entiers (coerce)', () => {
    const result = PaginationQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(result).toEqual({ page: 3, pageSize: 50 });
  });

  it('accepte les valeurs limites valides (pageSize=1 et pageSize=100)', () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: 1 })).not.toThrow();
    expect(() => PaginationQuerySchema.parse({ pageSize: 100 })).not.toThrow();
  });

  it('rejette page=0 (doit être positif)', () => {
    expect(() => PaginationQuerySchema.parse({ page: 0 })).toThrow();
  });

  it('rejette page=-1', () => {
    expect(() => PaginationQuerySchema.parse({ page: -1 })).toThrow();
  });

  it('rejette pageSize=0', () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: 0 })).toThrow();
  });

  it('rejette pageSize=101 (> 100)', () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('rejette une valeur décimale pour page', () => {
    expect(() => PaginationQuerySchema.parse({ page: 1.5 })).toThrow();
  });
});

describe('paginatedResponse', () => {
  it('valide une réponse paginée de strings', () => {
    const schema = paginatedResponse(z.string());
    const result = schema.parse({
      data: ['item1', 'item2'],
      total: 42,
      page: 1,
      pageSize: 20,
    });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(42);
  });

  it('rejette si total est négatif', () => {
    const schema = paginatedResponse(z.string());
    expect(() =>
      schema.parse({ data: [], total: -1, page: 1, pageSize: 20 }),
    ).toThrow();
  });

  it('valide une réponse paginée vide', () => {
    const schema = paginatedResponse(z.number());
    expect(() =>
      schema.parse({ data: [], total: 0, page: 1, pageSize: 20 }),
    ).not.toThrow();
  });
});
