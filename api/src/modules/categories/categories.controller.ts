import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import type { AdminRequest } from '../admin-auth/admin-auth.types';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@UseGuards(AdminAuthGuard)
@Controller('admin/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAllForAdmin();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateCategoryDto, @Req() req: AdminRequest) {
    return this.categoriesService.create(dto, req.admin!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: AdminRequest,
  ) {
    return this.categoriesService.update(id, dto, req.admin!.id);
  }
}
