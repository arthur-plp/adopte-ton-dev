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
const mockApplicationsClient = { send: jest.fn() };
const mockPaymentClient = { send: jest.fn() };

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: 'USERS_SVC', useValue: mockUsersClient },
        { provide: 'JOBS_SVC', useValue: mockJobsClient },
        { provide: 'APPLICATIONS_SVC', useValue: mockApplicationsClient },
        { provide: 'PAYMENT_SVC', useValue: mockPaymentClient },
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

  it('getStats → agrège les statistiques users, offres et candidatures', async () => {
    const users = { total: 10, developers: 5, recruiters: 3, admins: 2 };
    const jobOffers = { total: 4, draft: 1, published: 3 };
    const applications = { total: 6, accepted: 2, acceptanceRate: 50 };
    mockUsersClient.send.mockReturnValueOnce(of(users));
    mockJobsClient.send.mockReturnValueOnce(of(jobOffers));
    mockApplicationsClient.send.mockReturnValueOnce(of(applications));

    const result = await controller.getStats();

    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'admin.getStats' },
      {},
    );
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.getStats' },
      {},
    );
    expect(mockApplicationsClient.send).toHaveBeenCalledWith(
      { cmd: 'application.getStats' },
      {},
    );
    expect(result).toEqual({ users, jobOffers, applications });
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

  // ── Gestion des offres ────────────────────────────────────────────────────

  it('listAllOffers → appelle job.findAllForAdmin avec pagination, statut et recherche', async () => {
    const paginated = { data: [], total: 0, page: 1, pageSize: 20 };
    mockJobsClient.send.mockReturnValueOnce(of(paginated));
    const result = await controller.listAllOffers('1', '20', 'DRAFT', 'Acme');
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.findAllForAdmin' },
      { page: 1, pageSize: 20, status: 'DRAFT', search: 'Acme' },
    );
    expect(result).toEqual(paginated);
  });

  it('createOffer → appelle job.create avec recruiterId/companyId choisis et actor ADMIN', async () => {
    const offer = { id: 'job-1', status: 'DRAFT' };
    mockJobsClient.send.mockReturnValueOnce(of(offer));
    const result = await controller.createOffer(mockAdminReq, {
      recruiterId: 'recruiter-1',
      companyId: 'company-1',
      companyName: 'Acme',
      title: 'Dev TS',
      description: 'Description du poste qui fait bien 10 caractères',
      type: 'INTERNSHIP',
      remoteOk: false,
      requiredTechnologies: [],
      isPublic: true,
    });
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.create' },
      expect.objectContaining({
        recruiterId: 'recruiter-1',
        companyId: 'company-1',
        companyName: 'Acme',
        actor: { role: 'ADMIN', id: 'admin-1' },
      }),
    );
    expect(result).toEqual(offer);
  });

  it('createOffer → lance BadRequestException si recruiterId est absent', async () => {
    await expect(
      controller.createOffer(mockAdminReq, {
        companyId: 'company-1',
        title: 'Dev TS',
        description: 'Description du poste qui fait bien 10 caractères',
        type: 'INTERNSHIP',
      }),
    ).rejects.toThrow();
  });

  it("updateOffer → appelle job.update avec isAdmin=true et l'id de l'admin", async () => {
    const offer = { id: 'job-1', title: 'Corrigé' };
    mockJobsClient.send.mockReturnValueOnce(of(offer));
    const result = await controller.updateOffer(mockAdminReq, 'job-1', {
      title: 'Corrigé',
    });
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.update' },
      expect.objectContaining({
        id: 'job-1',
        recruiterId: 'admin-1',
        dto: expect.objectContaining({ title: 'Corrigé' }),
        isAdmin: true,
      }),
    );
    expect(result).toEqual(offer);
  });

  it("deleteOffer → appelle job.delete avec isAdmin=true et l'id de l'admin", async () => {
    mockJobsClient.send.mockReturnValueOnce(of({ ok: true }));
    const result = await controller.deleteOffer(mockAdminReq, 'job-1');
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.delete' },
      { id: 'job-1', recruiterId: 'admin-1', isAdmin: true },
    );
    expect(result).toEqual({ ok: true });
  });

  it("archiveOffer → appelle job.archive avec isAdmin=true et l'id de l'admin", async () => {
    mockJobsClient.send.mockReturnValueOnce(
      of({ id: 'job-1', status: 'ARCHIVED' }),
    );
    const result = await controller.archiveOffer(mockAdminReq, 'job-1');
    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: 'job.archive' },
      { id: 'job-1', recruiterId: 'admin-1', isAdmin: true },
    );
    expect(result).toEqual({ id: 'job-1', status: 'ARCHIVED' });
  });

  it('getOfferApplicationsCount → appelle application.countByJobOffer', async () => {
    mockApplicationsClient.send.mockReturnValueOnce(
      of({ total: 5, active: 2 }),
    );
    const result = await controller.getOfferApplicationsCount('job-1');
    expect(mockApplicationsClient.send).toHaveBeenCalledWith(
      { cmd: 'application.countByJobOffer' },
      { jobOfferId: 'job-1' },
    );
    expect(result).toEqual({ total: 5, active: 2 });
  });

  it('listApplications → appelle application.findAllForAdmin avec pagination et filtres', async () => {
    const paginated = {
      data: [{ id: 'app-1', status: 'SENT' }],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockApplicationsClient.send.mockReturnValueOnce(of(paginated));
    const result = await controller.listApplications(
      '1',
      '20',
      'SENT',
      'job-1',
    );
    expect(mockApplicationsClient.send).toHaveBeenCalledWith(
      { cmd: 'application.findAllForAdmin' },
      { page: 1, pageSize: 20, status: 'SENT', jobOfferId: 'job-1' },
    );
    expect(result).toEqual(paginated);
  });

  it('listApplications → utilise des valeurs par défaut sans filtre', async () => {
    const paginated = { data: [], total: 0, page: 1, pageSize: 20 };
    mockApplicationsClient.send.mockReturnValueOnce(of(paginated));
    await controller.listApplications('1', '20');
    expect(mockApplicationsClient.send).toHaveBeenCalledWith(
      { cmd: 'application.findAllForAdmin' },
      { page: 1, pageSize: 20, status: undefined, jobOfferId: undefined },
    );
  });

  it('updateApplicationStatus → appelle application.updateStatus avec isAdmin=true', async () => {
    mockApplicationsClient.send.mockReturnValueOnce(
      of({ id: 'app-1', status: 'REJECTED' }),
    );
    const result = await controller.updateApplicationStatus(
      mockAdminReq,
      'app-1',
      { status: 'REJECTED' },
    );
    expect(mockApplicationsClient.send).toHaveBeenCalledWith(
      { cmd: 'application.updateStatus' },
      {
        id: 'app-1',
        recruiterId: 'admin-1',
        dto: { status: 'REJECTED' },
        isAdmin: true,
      },
    );
    expect(result).toEqual({ id: 'app-1', status: 'REJECTED' });
  });

  it('updateApplicationStatus → lance BadRequestException si le statut est invalide', async () => {
    await expect(
      controller.updateApplicationStatus(mockAdminReq, 'app-1', {
        status: 'NOT_A_STATUS',
      }),
    ).rejects.toThrow();
  });

  // ── Abonnements ───────────────────────────────────────────────────────────

  it('listCompanies → enrichit chaque entreprise avec son abonnement', async () => {
    const companies = {
      data: [{ id: 'company-1', name: 'Acme', siret: null }],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockUsersClient.send.mockReturnValueOnce(of(companies));
    mockPaymentClient.send.mockReturnValueOnce(
      of({ plan: 'PRO', status: 'active', currentPeriodEnd: null }),
    );

    const result = await controller.listCompanies('1', '20');

    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'admin.listCompanies' },
      { page: 1, pageSize: 20, search: undefined },
    );
    expect(mockPaymentClient.send).toHaveBeenCalledWith(
      { cmd: 'payment.getSubscription' },
      { companyId: 'company-1' },
    );
    expect(result.data[0]).toEqual({
      id: 'company-1',
      name: 'Acme',
      siret: null,
      subscription: { plan: 'PRO', status: 'active', currentPeriodEnd: null },
    });
  });

  it('listCompanies → subscription: null si payment-svc est injoignable pour une entreprise', async () => {
    const companies = {
      data: [{ id: 'company-1', name: 'Acme', siret: null }],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockUsersClient.send.mockReturnValueOnce(of(companies));
    mockPaymentClient.send.mockImplementationOnce(() => {
      throw new Error('payment-svc down');
    });

    const result = await controller.listCompanies('1', '20');

    expect(result.data[0]).toMatchObject({ subscription: null });
  });

  it('setCompanyPlan → appelle payment.adminSetPlan avec le plan validé', async () => {
    mockPaymentClient.send.mockReturnValueOnce(of({ plan: 'PRO' }));
    const result = await controller.setCompanyPlan('company-1', {
      plan: 'PRO',
    });
    expect(mockPaymentClient.send).toHaveBeenCalledWith(
      { cmd: 'payment.adminSetPlan' },
      { companyId: 'company-1', plan: 'PRO' },
    );
    expect(result).toEqual({ plan: 'PRO' });
  });

  it('setCompanyPlan → lance BadRequestException si le plan est invalide', async () => {
    await expect(
      controller.setCompanyPlan('company-1', { plan: 'GOLD' }),
    ).rejects.toThrow();
  });

  it('listReports → appelle report.list avec le filtre statut et la pagination', async () => {
    const paginated = { data: [], total: 0, page: 1, pageSize: 20 };
    mockUsersClient.send.mockReturnValueOnce(of(paginated));
    const result = await controller.listReports('open', '1', '20');
    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'report.list' },
      { status: 'open', page: 1, pageSize: 20 },
    );
    expect(result).toEqual(paginated);
  });

  it('updateReportStatus → appelle report.updateStatus avec id et status', async () => {
    const updated = { id: 'report-1', status: 'resolved' };
    mockUsersClient.send.mockReturnValueOnce(of(updated));
    const result = await controller.updateReportStatus('report-1', {
      status: 'resolved',
    });
    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'report.updateStatus' },
      { id: 'report-1', status: 'resolved' },
    );
    expect(result).toEqual(updated);
  });
});
