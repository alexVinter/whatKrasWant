import { Controller, Get } from '@nestjs/common';
import { PublicIdeasService } from './public-ideas.service';

@Controller('public/map')
export class PublicMapController {
  constructor(private readonly publicIdeasService: PublicIdeasService) {}

  @Get('ideas')
  listIdeas() {
    return this.publicIdeasService.listMapMarkers();
  }
}
