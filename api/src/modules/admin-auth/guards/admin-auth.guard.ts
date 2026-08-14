import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdminAuthService } from '../admin-auth.service';
import { ADMIN_SESSION_COOKIE } from '../admin-auth.constants';
import type { AdminRequest } from '../admin-auth.types';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly authService: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const rawToken = request.cookies?.[ADMIN_SESSION_COOKIE] as
      | string
      | undefined;

    const { admin, session } =
      await this.authService.validateSession(rawToken);

    request.admin = admin;
    request.adminSession = session;
    return true;
  }
}
