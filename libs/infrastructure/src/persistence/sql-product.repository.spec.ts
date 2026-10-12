import { readProductSort } from '@domain/inventory/product-sort';
import { productPageSql } from '@infrastructure/persistence/sql-product.repository';

describe('product page sql', () => {
  it('orders by a fixed column before offset and fetch', () => {
    const descending = productPageSql(readProductSort('supplier:desc'));
    const offsetAt = descending.indexOf('OFFSET @offset');
    const orderAt = descending.lastIndexOf('ORDER BY', offsetAt);

    expect(offsetAt).toBeGreaterThan(orderAt);
    expect(descending.slice(orderAt, offsetAt)).toContain('supplier DESC, id ASC');
    expect(descending.indexOf('FETCH NEXT @pageSize')).toBeGreaterThan(offsetAt);
    expect(descending).toContain('ORDER BY page.sortIndex, r.unit');
    expect(descending).not.toContain('OUTER APPLY');
    expect(productPageSql(readProductSort('name:asc'))).toContain('name ASC, id ASC');
    expect(productPageSql(readProductSort('drop table:sideways'))).toContain('name ASC, id ASC');
    expect(productPageSql(readProductSort('salePrice:desc'))).toContain('salePrice DESC, id ASC');
    expect(productPageSql(readProductSort('salePrice:desc'))).toContain('OUTER APPLY');
  });
});
