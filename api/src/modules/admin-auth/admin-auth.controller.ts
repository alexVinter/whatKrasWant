import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { ADMIN_SESSION_COOKIE } from './admin-auth.constants';
import { LoginDto } from './dto/login.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import type { AdminRequest } from './admin-auth.types';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { admin, rawToken, expiresAt } = await this.authService.login(
      dto.login,
      dto.password,
    );

    res.cookie(ADMIN_SESSION_COOKIE, rawToken, this.cookieOptions(expiresAt));
    return { admin: this.authService.toSafeAdmin(admin) };
  }

  @UseGuards(AdminAuthGuard)
  @Get('session')
  session(@Req() req: AdminRequest) {
    return { admin: this.authService.toSafeAdmin(req.admin!) };
  }

  @UseGuards(AdminAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.adminSession!.id);
    res.clearCookie(ADMIN_SESSION_COOKIE, this.baseCookieOptions());
    return { success: true };
  }

  @UseGuards(AdminAuthGuard)
  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(req.admin!.id);
    res.clearCookie(ADMIN_SESSION_COOKIE, this.baseCookieOptions());
    return { success: true };
  }

  private baseCookieOptions(): CookieOptions {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
    };
  }

  private cookieOptions(expiresAt: Date): CookieOptions {
    return { ...this.baseCookieOptions(), expires: expiresAt };
  }
}
