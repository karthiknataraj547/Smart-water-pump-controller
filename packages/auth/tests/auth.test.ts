import { hashPassword, verifyPassword } from '../src/password';
import { signAccessToken, verifyToken, TokenUserPayload } from '../src/jwt';

describe('Auth Package (Argon2id & JWT)', () => {
  it('hashes and verifies passwords correctly with Argon2id', async () => {
    const password = 'SuperSecret123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);

    const isFalseMatch = await verifyPassword('WrongPassword', hash);
    expect(isFalseMatch).toBe(false);
  });

  it('signs and verifies JWT access tokens', async () => {
    const userPayload = {
      userId: 'usr_test_99',
      email: 'tester@smartpump.io',
      role: 'USER'
    };

    const token = await signAccessToken(userPayload);
    expect(token).toBeDefined();

    const decoded = await verifyToken<TokenUserPayload>(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(userPayload.userId);
    expect(decoded?.email).toBe(userPayload.email);
  });
});
