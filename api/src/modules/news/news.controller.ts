import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import type { AdminRequest } from '../admin-auth/admin-auth.types';
import { MulterExceptionFilter } from '../../common/multer-exception.filter';
import { NewsService } from './news.service';
import { NewsImageService } from './news-image.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

const UPLOAD_HARD_LIMIT = 15 * 1024 * 1024;

@UseGuards(AdminAuthGuard)
@Controller('admin/news')
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly newsImageService: NewsImageService,
  ) {}

  @Get()
  list() {
    return this.newsService.listAdmin();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateNewsDto, @Req() req: AdminRequest) {
    return this.newsService.create(dto, req.admin!.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsDto,
    @Req() req: AdminRequest,
  ) {
    return this.newsService.update(id, dto, req.admin!.id);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.newsService.publish(id, req.admin!.id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.newsService.unpublish(id, req.admin!.id);
  }

  @Post(':id/image')
  @HttpCode(200)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: UPLOAD_HARD_LIMIT } }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.newsImageService.upload(id, file, req.admin!.id);
  }

  @Delete(':id/image')
  @HttpCode(200)
  deleteImage(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.newsImageService.remove(id, req.admin!.id);
  }

  @Get(':id/image/:variant')
  async getImage(
    @Param('id') id: string,
    @Param('variant') variant: string,
    @Res() res: Response,
  ) {
    const object = await this.newsImageService.getAdminVariant(id, variant);
    res.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    object.body.pipe(res);
  }
}
