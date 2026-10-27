import type { PasswordHasher } from '@domain/identity/session/password-hasher.port';
import { hashPassword, verifyPassword } from '@infrastructure/identity/session/security/password-hash';

export class ScryptPasswordHasher implements PasswordHasher {
  hash(password: string): string {
    return hashPassword(password);
  }

  verify(password: string, encoded: string): boolean {
    return verifyPassword(password, encoded);
  }
}
