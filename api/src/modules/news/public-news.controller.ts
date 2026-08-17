import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NewsService } from './news.service';
import { NewsImageService } from './news-image.service';
import { ListPublicNewsDto } from './dto/list-public-news.dto';

@Controller('public/news')
export class PublicNewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly newsImageService: NewsImageService,
  ) {}

  @Get()
  list(@Query() query: ListPublicNewsDto) {
    return this.newsService.listPublic(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.newsService.findPublicBySlug(slug);
  }

  @Get(':slug/image/:variant')
  async getImage(
    @Param('slug') slug: string,
    @Param('variant') variant: string,
    @Res() res: Response,
  ) {
    const object = await this.newsImageService.getPublicVariant(slug, variant);
    res.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    object.body.pipe(res);
  }
}
