// Mock auth.guard before imports to avoid loading better-auth (ESM-only) in Jest
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { HttpException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@repo/types';
import type { Request } from 'express';

type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  image: string | null | undefined;
  role: string;
  onboarded: boolean;
  emailVerified: boolean;
  companyId?: string;
};

type AuthRequest = Request & { user: AuthenticatedUser };

const mockDeveloper: AuthenticatedUser = {
  id: 'dev-1',
  email: 'alice@test.com',
  name: 'Alice Dev',
  image: null,
  role: Role.DEVELOPER,
  onboarded: true,
  emailVerified: true,
};

function mockReq(user: AuthenticatedUser): AuthRequest {
  return { user } as AuthRequest;
}

const mockNotificationsClient = { send: jest.fn() };

describe('NotificationsController (api-gateway)', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: 'NOTIFICATIONS_SVC', useValue: mockNotificationsClient },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('transmet userId/page au notifications-svc', async () => {
      mockNotificationsClient.send.mockReturnValueOnce(
        of({ data: [], total: 0, page: 1, pageSize: 20 }),
      );

      await controller.list(mockReq(mockDeveloper), '2');

      expect(mockNotificationsClient.send).toHaveBeenCalledWith(
        { cmd: 'notifications.list' },
        { userId: 'dev-1', page: 2 },
      );
    });
  });

  describe('markRead', () => {
    it('transmet id/requesterId au notifications-svc', async () => {
      mockNotificationsClient.send.mockReturnValueOnce(of({ id: 'notif-1' }));

      await controller.markRead(mockReq(mockDeveloper), 'notif-1');

      expect(mockNotificationsClient.send).toHaveBeenCalledWith(
        { cmd: 'notifications.markRead' },
        { id: 'notif-1', requesterId: 'dev-1' },
      );
    });
  });

  describe('markAllRead', () => {
    it("transmet l'userId au notifications-svc", async () => {
      mockNotificationsClient.send.mockReturnValueOnce(of({ updated: 3 }));

      await controller.markAllRead(mockReq(mockDeveloper));

      expect(mockNotificationsClient.send).toHaveBeenCalledWith(
        { cmd: 'notifications.markAllRead' },
        { userId: 'dev-1' },
      );
    });
  });

  describe('getJobAlert', () => {
    it('transmet le developerId au notifications-svc', async () => {
      mockNotificationsClient.send.mockReturnValueOnce(of(null));

      await controller.getJobAlert(mockReq(mockDeveloper));

      expect(mockNotificationsClient.send).toHaveBeenCalledWith(
        { cmd: 'notifications.getJobAlert' },
        { developerId: 'dev-1' },
      );
    });
  });

  describe('upsertJobAlert', () => {
    it('valide et transmet le dto au notifications-svc', async () => {
      mockNotificationsClient.send.mockReturnValueOnce(
        of({ id: 'sub-1', technologies: ['React'] }),
      );

      await controller.upsertJobAlert(mockReq(mockDeveloper), {
        technologies: ['React'],
      });

      expect(mockNotificationsClient.send).toHaveBeenCalledWith(
        { cmd: 'notifications.upsertJobAlert' },
        { developerId: 'dev-1', dto: { technologies: ['React'] } },
      );
    });

    it('lance HttpException 400 si le payload est invalide', async () => {
      await expect(
        controller.upsertJobAlert(mockReq(mockDeveloper), {} as never),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteJobAlert', () => {
    it('transmet le developerId au notifications-svc', async () => {
      mockNotificationsClient.send.mockReturnValueOnce(of({ deleted: true }));

      await controller.deleteJobAlert(mockReq(mockDeveloper));

      expect(mockNotificationsClient.send).toHaveBeenCalledWith(
        { cmd: 'notifications.deleteJobAlert' },
        { developerId: 'dev-1' },
      );
    });
  });
});
