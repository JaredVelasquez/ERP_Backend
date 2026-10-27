import { healthResponse } from '@presentation/http/platform/health/health.response';

describe('health response', () => {
  it('names the process that is alive', () => {
    expect(healthResponse('gateway')).toEqual({ status: 'ok', service: 'gateway' });
  });
});
