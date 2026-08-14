import { AdminStatus, PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

/**
 * Development bootstrap для создания/обновления первого администратора.
 * Значения берутся ТОЛЬКО из окружения — секреты не хранятся в git.
 *
 * Требуемые переменные окружения:
 *   ADMIN_BOOTSTRAP_LOGIN
 *   ADMIN_BOOTSTRAP_PASSWORD
 *   ADMIN_BOOTSTRAP_EMAIL (опционально)
 */
async function main(): Promise<void> {
  const login = process.env.ADMIN_BOOTSTRAP_LOGIN?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || null;

  if (!login || !password) {
    console.error(
      'ADMIN_BOOTSTRAP_LOGIN and ADMIN_BOOTSTRAP_PASSWORD must be set.',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await argonHash(password);

    const admin = await prisma.adminUser.upsert({
      where: { login },
      update: {
        passwordHash,
        status: AdminStatus.ACTIVE,
        ...(email ? { email } : {}),
      },
      create: {
        login,
        passwordHash,
        status: AdminStatus.ACTIVE,
        email,
      },
    });

    console.log(
      `Admin ready: login="${admin.login}", id=${admin.id}, status=${admin.status}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to create/update admin.');
  console.error(error);
  process.exit(1);
});
