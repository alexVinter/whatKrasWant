import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PUBLIC_SESSION_COOKIE } from '../public-auth.constants';
import { PublicAuthGuard } from './public-auth.guard';
import { PublicAuthService } from '../public-auth.service';

describe('PublicAuthGuard', () => {
  const mockUser = {
    id: 'user-1',
    vkId: '123',
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
    isBlocked: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    revokedAt: null,
  };

  it('attaches user and session to request when cookie is valid', async () => {
    const authService = {
      validateSession: jest.fn().mockResolvedValue({
        user: mockUser,
        session: mockSession,
      }),
    } as unknown as PublicAuthService;

    const guard = new PublicAuthGuard(authService);
    const request = {
      cookies: { [PUBLIC_SESSION_COOKIE]: 'raw-token' },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toMatchObject({
      publicUser: mockUser,
      publicSession: mockSession,
    });
  });

  it('rejects invalid session', async () => {
    const authService = {
      validateSession: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException()),
    } as unknown as PublicAuthService;

    const guard = new PublicAuthGuard(authService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ cookies: {} }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
