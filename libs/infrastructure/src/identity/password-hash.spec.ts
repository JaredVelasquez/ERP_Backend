import { hashPassword, verifyPassword } from '@infrastructure/identity/password-hash';

describe('password hash', () => {
  it('accepts the original password and rejects another', () => {
    const encoded = hashPassword('correct-horse');

    expect(verifyPassword('correct-horse', encoded)).toBe(true);
    expect(verifyPassword('wrong-horse', encoded)).toBe(false);
    expect(verifyPassword('correct-horse', 'plain')).toBe(false);
  });
});
