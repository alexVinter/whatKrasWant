import { Module } from '@nestjs/common';
import { IdeasModule } from '../ideas/ideas.module';
import { SettingsModule } from '../settings/settings.module';
import { PublicIdeasController } from './public-ideas.controller';
import { PublicMapController } from './public-map.controller';
import { PublicIdeasService } from './public-ideas.service';

@Module({
  imports: [SettingsModule, IdeasModule],
  controllers: [PublicIdeasController, PublicMapController],
  providers: [PublicIdeasService],
})
export class IdeasPublicModule {}
