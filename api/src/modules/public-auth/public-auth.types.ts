import type { Request } from 'express';
import type { PublicSession, User } from '@prisma/client';

export interface SafePublicUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface PublicRequest extends Request {
  publicUser?: User;
  publicSession?: PublicSession;
}

export interface PublicSessionResponseAuthenticated {
  authenticated: true;
  user: SafePublicUser;
}

export interface PublicSessionResponseAnonymous {
  authenticated: false;
}

export type PublicSessionResponse =
  | PublicSessionResponseAuthenticated
  | PublicSessionResponseAnonymous;
