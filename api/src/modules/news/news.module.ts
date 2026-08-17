import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditModule } from '../audit/audit.module';
import { NewsController } from './news.controller';
import { PublicNewsController } from './public-news.controller';
import { NewsService } from './news.service';
import { NewsImageService } from './news-image.service';

@Module({
  imports: [AdminAuthModule, AuditModule],
  controllers: [NewsController, PublicNewsController],
  providers: [NewsService, NewsImageService],
})
export class NewsModule {}
