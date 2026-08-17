import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { AuditService } from './audit.service';
import { ListAuditDto } from './dto/list-audit.dto';

@UseGuards(AdminAuthGuard)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: ListAuditDto) {
    return this.auditService.list(query);
  }
}
