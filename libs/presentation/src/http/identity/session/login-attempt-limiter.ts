import { HttpException, Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '@domain/identity/session/password-hasher.port';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 6;

@Injectable()
export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, { failures: number[]; pending: number }>();

  async attempt<T>(email: string, work: () => Promise<T>): Promise<T> {
    const key = email.trim().toLowerCase();
    const now = Date.now();
    const state = this.attempts.get(key) ?? { failures: [], pending: 0 };
    state.failures = state.failures.filter((time) => now - time < WINDOW_MS);
    if (state.failures.length + state.pending >= MAX_FAILURES) {
      throw new HttpException('Demasiados intentos. Vuelve a intentarlo en unos minutos.', 429);
    }
    state.pending += 1;
    this.attempts.set(key, state);
    try {
      const result = await work();
      state.failures = [];
      return result;
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        state.failures.push(now);
      }
      throw error;
    } finally {
      state.pending -= 1;
      if (state.pending === 0 && state.failures.length === 0) this.attempts.delete(key);
      if (this.attempts.size > 10_000) this.attempts.clear();
    }
  }
}
