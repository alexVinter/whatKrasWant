import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { PublicSession, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { normalizePersonName } from '../../common/name/normalize-person-name.util';
import { DEFAULT_PUBLIC_SESSION_TTL_HOURS } from './public-auth.constants';
import type { SafePublicUser } from './public-auth.types';
import { VkIdClient } from './vk-id.client';

export interface PublicLoginResult {
  user: User;
  rawToken: string;
  expiresAt: Date;
}

@Injectable()
export class PublicAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly vkIdClient: VkIdClient,
  ) {}

  private sessionTtlMs(): number {
    const raw = Number(
      this.config.get<string>('PUBLIC_SESSION_TTL_HOURS') ??
        DEFAULT_PUBLIC_SESSION_TTL_HOURS,
    );
    const hours =
      Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PUBLIC_SESSION_TTL_HOURS;
    return hours * 60 * 60 * 1000;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  toSafeUser(user: User): SafePublicUser {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }

  async loginWithVkAccessToken(accessToken: string): Promise<PublicLoginResult> {
    const profile = await this.vkIdClient.fetchUserProfile(accessToken);
    const firstName = normalizePersonName(profile.firstName);
    const lastName = normalizePersonName(profile.lastName);

    const user = await this.prisma.user.upsert({
      where: { vkId: profile.vkId },
      create: {
        vkId: profile.vkId,
        firstName,
        lastName,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
      },
      update: {
        firstName,
        lastName,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
      },
    });

    if (user.isBlocked) {
      throw new ForbiddenException('User is blocked');
    }

    await this.prisma.publicSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.sessionTtlMs());

    await this.prisma.publicSession.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return { user, rawToken, expiresAt };
  }

  async tryGetSession(
    rawToken: string | undefined,
  ): Promise<{ user: User; session: PublicSession } | null> {
    if (!rawToken) {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.publicSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.isBlocked
    ) {
      return null;
    }

    return { user: session.user, session };
  }

  async validateSession(
    rawToken: string | undefined,
  ): Promise<{ user: User; session: PublicSession }> {
    if (!rawToken) {
      throw new UnauthorizedException();
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.publicSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }

    if (session.user.isBlocked) {
      throw new ForbiddenException('User is blocked');
    }

    return { user: session.user, session };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.publicSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
