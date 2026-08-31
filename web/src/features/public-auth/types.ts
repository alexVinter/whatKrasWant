export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface PublicSessionAuthenticated {
  authenticated: true;
  user: PublicUser;
}

export interface PublicSessionAnonymous {
  authenticated: false;
}

export type PublicSessionState =
  | PublicSessionAuthenticated
  | PublicSessionAnonymous;

export interface VkLoginResponse {
  user: PublicUser;
}
