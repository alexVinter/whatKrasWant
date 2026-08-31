import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PUBLIC_SESSION_COOKIE } from '../public-auth.constants';
import { PublicAuthService } from '../public-auth.service';
import type { PublicRequest } from '../public-auth.types';

@Injectable()
export class PublicAuthGuard implements CanActivate {
  constructor(private readonly authService: PublicAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicRequest>();
    const rawToken = request.cookies?.[PUBLIC_SESSION_COOKIE] as
      | string
      | undefined;

    const { user, session } =
      await this.authService.validateSession(rawToken);

    request.publicUser = user;
    request.publicSession = session;
    return true;
  }
}
