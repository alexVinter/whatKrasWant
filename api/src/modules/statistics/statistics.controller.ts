import { Controller, Get, Header, StreamableFile, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { StatisticsService } from './statistics.service';
import { StatisticsXlsxService } from './xlsx.service';
import { XLSX_CONTENT_TYPE } from './statistics.labels';

@UseGuards(AdminAuthGuard)
@Controller('admin/statistics')
export class StatisticsController {
  constructor(
    private readonly statistics: StatisticsService,
    private readonly xlsx: StatisticsXlsxService,
  ) {}

  @Get()
  getSummary() {
    return this.statistics.getSummary();
  }

  @Get('xlsx')
  @Header('Content-Type', XLSX_CONTENT_TYPE)
  async downloadXlsx(): Promise<StreamableFile> {
    const { buffer, filename } = await this.xlsx.build();
    return new StreamableFile(buffer, {
      type: XLSX_CONTENT_TYPE,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
