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
import { DistrictsService } from './districts.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';

@UseGuards(AdminAuthGuard)
@Controller('admin/districts')
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  findAll() {
    return this.districtsService.findAllForAdmin();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateDistrictDto, @Req() req: AdminRequest) {
    return this.districtsService.create(dto, req.admin!.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDistrictDto,
    @Req() req: AdminRequest,
  ) {
    return this.districtsService.update(id, dto, req.admin!.id);
  }
}
