export const SHELF_FAMILIES = ['Pan', 'Lácteos', 'Abarrotes', 'Bebidas', 'Limpieza'] as const;

export type ShelfFamily = (typeof SHELF_FAMILIES)[number];

export interface ShelfInput {
  name: string;
  category: string;
  supplier: string | null;
}

export interface ShelfAssignment {
  category: ShelfFamily;
  supplier: string | null;
}

const LIMPIEZA = ['jabon', 'cloro', 'detergente', 'desinfectante', 'suavizante', 'lavaplatos', 'escoba', 'trapeador', 'blanqueador', 'shampoo', 'champu', 'dental', 'desodorante', 'limpiador', 'limpieza'];
const BEBIDAS = ['refresco', 'jugo', 'agua', 'cerveza', 'soda', 'gaseosa', 'bebida', 'nectar', 'malta', 'cola', 'pepsi', 'coca', 'vino', 'licor', 'energizante'];
const LACTEOS = ['leche', 'queso', 'yogurt', 'yogur', 'crema', 'mantequilla', 'requeson', 'natilla', 'margarina'];
const PAN = ['pan', 'panes', 'bollo', 'semita', 'tortilla', 'baguette'];

export function reclassifyShelf(input: ShelfInput): ShelfAssignment {
  if (isShelfFamily(input.category)) {
    return { category: input.category, supplier: input.supplier };
  }
  return { category: familyFromName(input.name), supplier: movedSupplier(input.category, input.supplier) };
}

function isShelfFamily(value: string): value is ShelfFamily {
  return (SHELF_FAMILIES as readonly string[]).includes(value);
}

function familyFromName(name: string): ShelfFamily {
  const folded = fold(name);
  if (hasToken(folded, LIMPIEZA)) {
    return 'Limpieza';
  }
  if (hasToken(folded, BEBIDAS)) {
    return 'Bebidas';
  }
  if (hasToken(folded, LACTEOS)) {
    return 'Lácteos';
  }
  if (hasToken(folded, PAN)) {
    return 'Pan';
  }
  return 'Abarrotes';
}

function movedSupplier(category: string, supplier: string | null): string | null {
  const label = category.trim();
  if (label === '') {
    return supplier;
  }
  return label;
}

function hasToken(folded: string, tokens: readonly string[]): boolean {
  for (const token of tokens) {
    if (hits(folded, token)) {
      return true;
    }
  }
  return false;
}

function hits(folded: string, token: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${token}(?:[^a-z0-9]|$)`, 'i').test(folded);
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}
