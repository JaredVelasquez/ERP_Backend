export interface PasswordHasher {
  hash(password: string): string;
  verify(password: string, encoded: string): boolean;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class RegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrationError';
  }
}
