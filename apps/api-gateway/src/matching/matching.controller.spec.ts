// Mock auth.guard before imports to avoid loading better-auth (ESM-only) in Jest
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
import { MatchingController } from './matching.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockMatchingClient = { send: jest.fn() };

describe('MatchingController', () => {
  let controller: MatchingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchingController],
      providers: [{ provide: 'MATCHING_SVC', useValue: mockMatchingClient }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MatchingController>(MatchingController);
    jest.clearAllMocks();
  });

  describe('searchDevelopers', () => {
    it('parse les filtres et transmet à matching-svc avec pagination', async () => {
      const expected = { data: [], total: 0, page: 1, pageSize: 20 };
      mockMatchingClient.send.mockReturnValueOnce(of(expected));

      const result = await controller.searchDevelopers(
        { technologies: ['React'], remoteOk: 'true' },
        '1',
        '20',
      );

      expect(mockMatchingClient.send).toHaveBeenCalledWith(
        { cmd: 'matching.searchDevelopers' },
        { technologies: ['React'], remoteOk: true, page: 1, pageSize: 20 },
      );
      expect(result).toEqual(expected);
    });

    it('lance une BadRequestException si levels est un JSON invalide', async () => {
      await expect(
        controller.searchDevelopers({ levels: 'pas-du-json' }, '1', '20'),
      ).rejects.toThrow(BadRequestException);
      expect(mockMatchingClient.send).not.toHaveBeenCalled();
    });

    it('propage une HttpException si matching-svc échoue', async () => {
      mockMatchingClient.send.mockReturnValueOnce(
        throwError(() => ({
          statusCode: 502,
          message: 'Service indisponible',
        })),
      );

      await expect(controller.searchDevelopers({}, '1', '20')).rejects.toThrow(
        HttpException,
      );
    });

    it('borne pageSize à 100 maximum', async () => {
      mockMatchingClient.send.mockReturnValueOnce(
        of({ data: [], total: 0, page: 1, pageSize: 100 }),
      );

      await controller.searchDevelopers({}, '1', '500');

      expect(mockMatchingClient.send).toHaveBeenCalledWith(
        { cmd: 'matching.searchDevelopers' },
        expect.objectContaining({ pageSize: 100 }),
      );
    });
  });
});
