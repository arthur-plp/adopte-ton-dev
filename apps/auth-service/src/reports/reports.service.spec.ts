import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  report: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const baseReport = {
  id: 'report-1',
  reporterId: 'user-1',
  targetType: 'profile',
  targetId: 'dev-1',
  reason: 'Contenu inapproprié',
  status: 'open',
  createdAt: new Date(),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée un signalement avec le reporterId fourni', async () => {
      mockPrisma.report.create.mockResolvedValueOnce(baseReport);

      const result = await service.create('user-1', {
        targetType: 'profile',
        targetId: 'dev-1',
        reason: 'Contenu inapproprié',
      });

      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'user-1',
          targetType: 'profile',
          targetId: 'dev-1',
          reason: 'Contenu inapproprié',
        },
      });
      expect(result).toEqual(baseReport);
    });
  });

  describe('list', () => {
    it('filtre par statut et pagine', async () => {
      mockPrisma.report.findMany.mockResolvedValueOnce([baseReport]);
      mockPrisma.report.count.mockResolvedValueOnce(1);

      const result = await service.list({
        status: 'open',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: [baseReport],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it("ne filtre pas par statut si aucun n'est fourni", async () => {
      mockPrisma.report.findMany.mockResolvedValueOnce([]);
      mockPrisma.report.count.mockResolvedValueOnce(0);

      await service.list({ page: 1, pageSize: 20 });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('updateStatus', () => {
    it('met à jour le statut si le signalement existe', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce(baseReport);
      mockPrisma.report.update.mockResolvedValueOnce({
        ...baseReport,
        status: 'resolved',
      });

      const result = await service.updateStatus('report-1', 'resolved');

      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: { status: 'resolved' },
      });
      expect(result.status).toBe('resolved');
    });

    it('lance NotFoundException si le signalement est introuvable', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce(null);

      await expect(service.updateStatus('unknown', 'resolved')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
