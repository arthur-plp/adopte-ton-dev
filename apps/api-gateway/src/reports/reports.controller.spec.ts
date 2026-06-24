jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { BadRequestException, HttpException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { AuthGuard } from '../auth/auth.guard';

const mockUsersClient = { send: jest.fn() };

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: 'USERS_SVC', useValue: mockUsersClient }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportsController>(ReportsController);
    jest.clearAllMocks();
  });

  const req = { user: { id: 'user-1', role: 'DEVELOPER' } } as never;

  it('crée un signalement avec le reporterId issu de la session', async () => {
    const expected = { id: 'report-1' };
    mockUsersClient.send.mockReturnValueOnce(of(expected));

    const body = { targetType: 'profile', targetId: 'dev-1', reason: 'Spam' };
    const result = await controller.create(req, body);

    expect(mockUsersClient.send).toHaveBeenCalledWith(
      { cmd: 'report.create' },
      { reporterId: 'user-1', dto: body },
    );
    expect(result).toEqual(expected);
  });

  it('lance une BadRequestException si le payload est invalide', async () => {
    await expect(
      controller.create(req, {
        targetType: 'invalid',
        targetId: 'x',
        reason: 'a',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockUsersClient.send).not.toHaveBeenCalled();
  });

  it('propage une HttpException si auth-service échoue', async () => {
    mockUsersClient.send.mockReturnValueOnce(
      throwError(() => ({ statusCode: 500, message: 'Erreur' })),
    );

    await expect(
      controller.create(req, {
        targetType: 'profile',
        targetId: 'dev-1',
        reason: 'Spam',
      }),
    ).rejects.toThrow(HttpException);
  });
});
