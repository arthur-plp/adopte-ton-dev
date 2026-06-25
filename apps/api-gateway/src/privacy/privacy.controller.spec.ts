jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { PrivacyController } from './privacy.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@repo/types';

const mockUsersClient = { send: jest.fn() };
const mockJobsClient = { send: jest.fn() };
const mockApplicationsClient = { send: jest.fn() };

function makeRequest(role: string) {
  return {
    user: {
      id: 'user-1',
      role,
      name: 'Test',
      email: 't@t.com',
      image: null,
      onboarded: true,
      emailVerified: true,
    },
  } as never;
}

describe('PrivacyController', () => {
  let controller: PrivacyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrivacyController],
      providers: [
        { provide: 'USERS_SVC', useValue: mockUsersClient },
        { provide: 'JOBS_SVC', useValue: mockJobsClient },
        { provide: 'APPLICATIONS_SVC', useValue: mockApplicationsClient },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PrivacyController>(PrivacyController);
    jest.clearAllMocks();
  });

  describe('exportMyData', () => {
    it('agrège identité + offres pour un recruteur', async () => {
      const identity = { user: { id: 'user-1' }, profile: null };
      const jobOffers = [{ id: 'job-1' }];
      mockUsersClient.send.mockReturnValueOnce(of(identity));
      mockJobsClient.send.mockReturnValueOnce(of(jobOffers));

      const result = await controller.exportMyData(makeRequest(Role.RECRUITER));

      expect(mockUsersClient.send).toHaveBeenCalledWith(
        { cmd: 'users.exportData' },
        { userId: 'user-1' },
      );
      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.findMine' },
        { recruiterId: 'user-1' },
      );
      expect(mockApplicationsClient.send).not.toHaveBeenCalled();
      expect(result).toEqual({ identity, jobOffers, applications: null });
    });

    it('agrège identité + candidatures pour un développeur', async () => {
      const identity = { user: { id: 'user-1' }, profile: null };
      const applications = [{ id: 'app-1' }];
      mockUsersClient.send.mockReturnValueOnce(of(identity));
      mockApplicationsClient.send.mockReturnValueOnce(of(applications));

      const result = await controller.exportMyData(makeRequest(Role.DEVELOPER));

      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.findMine' },
        { developerId: 'user-1' },
      );
      expect(mockJobsClient.send).not.toHaveBeenCalled();
      expect(result).toEqual({ identity, jobOffers: null, applications });
    });
  });

  describe('deleteMyAccount', () => {
    it('appelle users.deleteOwnAccount avec le userId de la session', async () => {
      mockUsersClient.send.mockReturnValueOnce(of({ ok: true }));

      const result = await controller.deleteMyAccount(
        makeRequest(Role.DEVELOPER),
      );

      expect(mockUsersClient.send).toHaveBeenCalledWith(
        { cmd: 'users.deleteOwnAccount' },
        { userId: 'user-1' },
      );
      expect(result).toEqual({ ok: true });
    });
  });
});
