import { createCompany, createDefaultWarehouse, CompanyIdentityError } from '@domain/tenancy/company/company';

describe('company identity', () => {
  it('keeps the RTN on the company and starts tax off with an empty margin', () => {
    const company = createCompany({
      id: 'company-1',
      societyId: 'society-1',
      legalName: 'Michelle Market',
      rtn: '08019999999999',
      currencyCode: 'HNL',
      costingMethod: 'PEPS',
      defaultMarginPercent: null,
    });

    expect(company.rtn).toBe('08019999999999');
    expect(company.taxEnabled).toBe(false);
    expect(company.defaultMarginPercent).toBeNull();
    expect(company.costingMethod).toBe('PEPS');
    expect(createDefaultWarehouse(company.id, 'warehouse-1').name).toBe('Principal');
  });

  it('rejects a company without RTN', () => {
    expect(() =>
      createCompany({
        id: 'company-1',
        societyId: 'society-1',
        legalName: 'Michelle Market',
        rtn: '   ',
        currencyCode: 'HNL',
        costingMethod: 'PEPS',
        defaultMarginPercent: null,
      }),
    ).toThrow(CompanyIdentityError);
  });
});
