jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AdminController } from './admin.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockUsersClient = { send: jest.fn() };
const mockJobsClient = { send: jest.fn() };

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: 'USERS_SVC', useValue: mockUsersClient },
        { provide: 'JOBS_SVC', useValue: mockJobsClient },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  it('getStats → appelle admin.getStats', async () => {
    const stats = { total: 10, developers: 5, recruiters: 3, admins: 2 };
    mockUsersClient.send.mockReturnValueOnce(of(stats));
    const result = await controller.getStats();
    expect(result).toEqual(stats);
  });

  it('listUsers → appelle admin.listUsers avec pagination', async () => {
    const paginated = { data: [], total: 0, page: 1, pageSize: 20 };
    mockUsersClient.send.mockReturnValueOnce(of(paginated));
    const result = await controller.listUsers('1', '20');
    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'admin.listUsers' },
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
    expect(result).toEqual(paginated);
  });

  it('listUsers → passe le filtre de rôle et la recherche', async () => {
    mockUsersClient.send.mockReturnValueOnce(
      of({ data: [], total: 0, page: 1, pageSize: 10 }),
    );
    await controller.listUsers('1', '10', 'alice', 'DEVELOPER');
    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'admin.listUsers' },
      expect.objectContaining({ search: 'alice', role: 'DEVELOPER' }),
    );
  });

  it('promoteToRecruiter → appelle admin.promoteToRecruiter', async () => {
    mockUsersClient.send.mockReturnValueOnce(of({ ok: true }));
    const result = await controller.promoteToRecruiter('u1', {
      companyName: 'Acme',
      firstName: 'Bob',
      lastName: 'M',
    });
    expect(result).toEqual({ ok: true });
  });

  it('updateUser → appelle admin.updateUser', async () => {
    mockUsersClient.send.mockReturnValueOnce(of({ id: 'u1', name: 'Alice' }));
    await controller.updateUser('u1', { name: 'Alice' });
    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'admin.updateUser' },
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('deleteUser → appelle admin.deleteUser', async () => {
    mockUsersClient.send.mockReturnValueOnce(of({ ok: true }));
    await controller.deleteUser('u1');
    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'admin.deleteUser' },
      { userId: 'u1' },
    );
  });

  it('listPendingOffers → appelle job.findPendingReview', async () => {
    const paginated = { data: [], total: 0, page: 1, pageSize: 10 };
    mockJobsClient.send.mockReturnValueOnce(of(paginated));
    const result = await controller.listPendingOffers('1', '10');
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.findPendingReview' },
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
    expect(result).toEqual(paginated);
  });

  const mockAdminReq = { user: { id: 'admin-1' } } as Parameters<
    AdminController['approveOffer']
  >[0];

  it('approveOffer → appelle job.approve avec adminId', async () => {
    const offer = { id: 'job-1', status: 'APPROVED' };
    mockJobsClient.send.mockReturnValueOnce(of(offer));
    const result = await controller.approveOffer(mockAdminReq, 'job-1');
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.approve' },
      { id: 'job-1', adminId: 'admin-1' },
    );
    expect(result).toEqual(offer);
  });

  it('rejectOffer → appelle job.reject avec le motif et adminId', async () => {
    const offer = { id: 'job-1', status: 'REJECTED' };
    mockJobsClient.send.mockReturnValueOnce(of(offer));
    await controller.rejectOffer(mockAdminReq, 'job-1', {
      reason: 'Incomplet',
    });
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.reject' },
      { id: 'job-1', reason: 'Incomplet', adminId: 'admin-1' },
    );
  });

  it('getOfferHistory → appelle job.getHistory avec isAdmin=true', async () => {
    mockJobsClient.send.mockReturnValueOnce(of([]));
    await controller.getOfferHistory(mockAdminReq, 'job-1');
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.getHistory' },
      { id: 'job-1', requesterId: 'admin-1', isAdmin: true },
    );
  });
});
