import { reclassifyShelf } from '@domain/inventory/shelf';

describe('shelf families', () => {
  it('moves a supplier label into supplier and keeps the family on a second run', () => {
    const first = reclassifyShelf({ name: 'PAN MOLDE BIMBO', category: 'AMAZON', supplier: null });
    const again = reclassifyShelf({ name: 'PAN MOLDE BIMBO', category: first.category, supplier: first.supplier });

    expect(first).toEqual({ category: 'Pan', supplier: 'AMAZON' });
    expect(again).toEqual(first);
    expect(reclassifyShelf({ name: 'LECHE ENTERA', category: 'SUPER BARATO', supplier: null }).category).toBe('Lácteos');
    expect(reclassifyShelf({ name: 'REFRESCO COLA', category: 'COCA COLA', supplier: null }).category).toBe('Bebidas');
    expect(reclassifyShelf({ name: 'JABON DE TOCADOR', category: 'DISNA', supplier: null }).category).toBe('Limpieza');
    expect(reclassifyShelf({ name: 'ARROZ PREMIUM', category: 'DINANT', supplier: null }).category).toBe('Abarrotes');
    expect(reclassifyShelf({ name: 'EMPANADA', category: 'BIMBO', supplier: null }).category).toBe('Abarrotes');
    expect(reclassifyShelf({ name: 'CREMA DENTAL', category: 'COLGATE', supplier: null }).category).toBe('Limpieza');
  });
});
