import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicIdeasService } from './public-ideas.service';
import { ListPublicIdeasDto } from './dto/list-public-ideas.dto';

@Controller('public/ideas')
export class PublicIdeasController {
  constructor(private readonly publicIdeasService: PublicIdeasService) {}

  @Get()
  list(@Query() query: ListPublicIdeasDto) {
    return this.publicIdeasService.list(query);
  }

  @Get(':slug/image/:variant')
  async getImage(
    @Param('slug') slug: string,
    @Param('variant') variant: string,
    @Res() res: Response,
  ) {
    const object = await this.publicIdeasService.getImageVariant(slug, variant);
    res.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    object.body.pipe(res);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.publicIdeasService.findBySlug(slug);
  }
}
