import { likeTerm, readPageRequest, slicePage } from '@domain/workspace/company-list/page';

describe('page request', () => {
  it('bounds the page and keeps the next page disjoint', () => {
    const request = readPageRequest('0', '500', '  pan  ');
    const page = slicePage(['a', 'b', 'c'], { ...request, page: 2, pageSize: 2 });

    expect(request).toEqual({ page: 1, pageSize: 100, search: 'pan', sort: '' });
    expect(readPageRequest('1', '25', '', ' name:desc ').sort).toBe('name:desc');
    expect(readPageRequest('2', '10', '').pageSize).toBe(10);
    expect(page.items).toEqual(['c']);
    expect(page.total).toBe(3);
    expect(likeTerm('100%')).toBe('%100[%]%');
    expect(likeTerm('')).toBe('%');
  });
});
