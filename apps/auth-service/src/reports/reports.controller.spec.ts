import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const mockService = {
  create: jest.fn(),
  list: jest.fn(),
  updateStatus: jest.fn(),
};

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    jest.clearAllMocks();
  });

  it('create → délègue reporterId et dto au service', async () => {
    mockService.create.mockResolvedValueOnce({ id: 'report-1' });
    const dto = {
      targetType: 'profile' as const,
      targetId: 'dev-1',
      reason: 'Spam',
    };
    await controller.create({ reporterId: 'user-1', dto });
    expect(mockService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('list → délègue les filtres au service', async () => {
    mockService.list.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    await controller.list({ status: 'open', page: 1, pageSize: 20 });
    expect(mockService.list).toHaveBeenCalledWith({
      status: 'open',
      page: 1,
      pageSize: 20,
    });
  });

  it('updateStatus → délègue id et status au service', async () => {
    mockService.updateStatus.mockResolvedValueOnce({
      id: 'report-1',
      status: 'resolved',
    });
    await controller.updateStatus({ id: 'report-1', status: 'resolved' });
    expect(mockService.updateStatus).toHaveBeenCalledWith(
      'report-1',
      'resolved',
    );
  });
});
