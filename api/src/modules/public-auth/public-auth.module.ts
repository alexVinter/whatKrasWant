import { Module } from '@nestjs/common';
import { PublicAuthController } from './public-auth.controller';
import { PublicAuthService } from './public-auth.service';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { VkIdClient } from './vk-id.client';

@Module({
  controllers: [PublicAuthController],
  providers: [PublicAuthService, PublicAuthGuard, VkIdClient],
  exports: [PublicAuthService, PublicAuthGuard],
})
export class PublicAuthModule {}
