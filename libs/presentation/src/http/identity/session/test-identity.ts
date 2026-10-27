import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import type { MembershipRole } from '@domain/identity/membership/access';
import type { INestApplication } from '@nestjs/common';

export async function registerTestUser(
  app: INestApplication,
  input: { email: string; displayName: string; companyId: string; role: MembershipRole },
): Promise<{ userId: string; password: string }> {
  const password = 'password1';
  const created = await app.get(RegisterUserUseCase).execute({ ...input, password });
  return { userId: created.userId, password };
}
