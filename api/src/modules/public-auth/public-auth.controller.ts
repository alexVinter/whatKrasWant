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
import { VkLoginDto } from './dto/vk-login.dto';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { PUBLIC_SESSION_COOKIE } from './public-auth.constants';
import { PublicAuthService } from './public-auth.service';
import type { PublicRequest, PublicSessionResponse } from './public-auth.types';

@Controller('public/auth')
export class PublicAuthController {
  constructor(
    private readonly authService: PublicAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('vk')
  @HttpCode(200)
  async loginWithVk(
    @Body() dto: VkLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, rawToken, expiresAt } =
      await this.authService.loginWithVkAccessToken(dto.accessToken);

    res.cookie(PUBLIC_SESSION_COOKIE, rawToken, this.cookieOptions(expiresAt));
    return { user: this.authService.toSafeUser(user) };
  }

  @Get('session')
  async session(@Req() req: PublicRequest): Promise<PublicSessionResponse> {
    const rawToken = req.cookies?.[PUBLIC_SESSION_COOKIE] as string | undefined;
    const result = await this.authService.tryGetSession(rawToken);

    if (!result) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: this.authService.toSafeUser(result.user),
    };
  }

  @UseGuards(PublicAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: PublicRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.publicSession!.id);
    res.clearCookie(PUBLIC_SESSION_COOKIE, this.baseCookieOptions());
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
