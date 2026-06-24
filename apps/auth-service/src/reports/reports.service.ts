import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReportDto, ReportStatus } from '@repo/contracts';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  create(reporterId: string, dto: CreateReportDto) {
    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
  }

  async list(filters: {
    status?: ReportStatus;
    page: number;
    pageSize: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;

    const skip = (filters.page - 1) * filters.pageSize;
    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { data, total, page: filters.page, pageSize: filters.pageSize };
  }

  async updateStatus(id: string, status: ReportStatus) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Signalement introuvable');
    return this.prisma.report.update({ where: { id }, data: { status } });
  }
}
