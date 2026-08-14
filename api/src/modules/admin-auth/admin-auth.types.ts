import type { Request } from 'express';
import type { AdminSession, AdminUser } from '@prisma/client';

export interface SafeAdmin {
  id: string;
  login: string;
  email: string | null;
}

export interface AdminRequest extends Request {
  admin?: AdminUser;
  adminSession?: AdminSession;
}
