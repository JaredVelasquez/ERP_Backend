import { assertPrecision, CompanyControlsError } from './company-controls';

describe('company controls', () => {
  it('accepts independent calculation, report, and document precision', () => {
    expect(() => assertPrecision({ quantityDigits: 4, unitCostDigits: 4, calculationDigits: 6, reportDigits: 2, documentDigits: 2, roundingMode: 'half-up' })).not.toThrow();
  });

  it('rejects calculation precision below unit cost precision', () => {
    expect(() => assertPrecision({ quantityDigits: 4, unitCostDigits: 6, calculationDigits: 4, reportDigits: 2, documentDigits: 2, roundingMode: 'half-up' })).toThrow(CompanyControlsError);
  });
});
