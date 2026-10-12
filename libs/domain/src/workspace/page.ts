export interface PageRequest {
  page: number;
  pageSize: number;
  search: string;
  sort: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function readPageRequest(pageText: string, sizeText: string, search: string, sort = ''): PageRequest {
  return {
    page: pageNumber(pageText),
    pageSize: boundedPageSize(sizeText),
    search: search.trim(),
    sort: sort.trim(),
  };
}

export function clampPageSize(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  if (value > MAX_PAGE_SIZE) {
    return MAX_PAGE_SIZE;
  }
  return value;
}

export function pageOffset(request: PageRequest): number {
  return (request.page - 1) * request.pageSize;
}

export function likeTerm(search: string): string {
  if (search.trim() === '') {
    return '%';
  }
  return `%${escapeLike(search.trim())}%`;
}

export function slicePage<T>(items: readonly T[], request: PageRequest): Page<T> {
  const start = pageOffset(request);
  return {
    items: items.slice(start, start + request.pageSize),
    page: request.page,
    pageSize: request.pageSize,
    total: items.length,
  };
}

function pageNumber(text: string): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }
  return value;
}

function boundedPageSize(text: string): number {
  return clampPageSize(Number(text));
}

function escapeLike(value: string): string {
  return value.replaceAll('[', '[[]').replaceAll('%', '[%]').replaceAll('_', '[_]');
}
