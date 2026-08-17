import { Controller, Get } from '@nestjs/common';
import { PublicConfigService } from './public-config.service';

@Controller('public/config')
export class PublicConfigController {
  constructor(private readonly publicConfigService: PublicConfigService) {}

  @Get()
  getConfig() {
    return this.publicConfigService.getConfig();
  }
}
