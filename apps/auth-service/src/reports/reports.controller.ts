import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReportsService } from './reports.service';
import type { CreateReportDto, ReportStatus } from '@repo/contracts';

@Controller()
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @MessagePattern({ cmd: 'report.create' })
  create(@Payload() data: { reporterId: string; dto: CreateReportDto }) {
    return this.service.create(data.reporterId, data.dto);
  }

  @MessagePattern({ cmd: 'report.list' })
  list(
    @Payload()
    data: {
      status?: ReportStatus;
      page: number;
      pageSize: number;
    },
  ) {
    return this.service.list(data);
  }

  @MessagePattern({ cmd: 'report.updateStatus' })
  updateStatus(@Payload() data: { id: string; status: ReportStatus }) {
    return this.service.updateStatus(data.id, data.status);
  }
}
