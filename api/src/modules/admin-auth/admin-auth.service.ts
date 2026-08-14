import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { AdminStatus } from '@prisma/client';
import type { AdminSession, AdminUser } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DEFAULT_ADMIN_SESSION_TTL_HOURS } from './admin-auth.constants';
import type { SafeAdmin } from './admin-auth.types';

export interface LoginResult {
  admin: AdminUser;
  rawToken: string;
  expiresAt: Date;
}

@Injectable()
export class AdminAuthService {
  // Валидный argon2-хэш случайного значения. Используется для выравнивания
  // времени ответа, когда login не найден или администратор неактивен, чтобы
  // не раскрывать существование конкретного login.
  private dummyHash: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  hashPassword(password: string): Promise<string> {
    return argonHash(password);
  }

  private sessionTtlMs(): number {
    const raw = Number(
      this.config.get<string>('ADMIN_SESSION_TTL_HOURS') ??
        DEFAULT_ADMIN_SESSION_TTL_HOURS,
    );
    const hours =
      Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ADMIN_SESSION_TTL_HOURS;
    return hours * 60 * 60 * 1000;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await argonHash(randomBytes(32).toString('hex'));
    }
    return this.dummyHash;
  }

  toSafeAdmin(admin: AdminUser): SafeAdmin {
    return { id: admin.id, login: admin.login, email: admin.email };
  }

  async login(login: string, password: string): Promise<LoginResult> {
    const admin = await this.prisma.adminUser.findUnique({ where: { login } });
    const isActive = admin?.status === AdminStatus.ACTIVE;

    // Всегда выполняем verify (по реальному или dummy-хэшу) — единообразный ответ и время.
    const hashToCheck = isActive ? admin!.passwordHash : await this.getDummyHash();
    const passwordOk = await argonVerify(hashToCheck, password).catch(() => false);

    if (!admin || !isActive || !passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.sessionTtlMs());

    await this.prisma.adminSession.create({
      data: { adminUserId: admin.id, tokenHash, expiresAt },
    });
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return { admin, rawToken, expiresAt };
  }

  async validateSession(
    rawToken: string | undefined,
  ): Promise<{ admin: AdminUser; session: AdminSession }> {
    if (!rawToken) {
      throw new UnauthorizedException();
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.adminUser.status !== AdminStatus.ACTIVE
    ) {
      throw new UnauthorizedException();
    }

    return { admin: session.adminUser, session };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(adminUserId: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { adminUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
