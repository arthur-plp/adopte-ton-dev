// Mock auth-session avant les imports pour éviter de charger better-auth
// (ESM-only) dans Jest — RealtimeGateway l'importe directement.
jest.mock('../auth/auth-session', () => ({
  resolveSessionUser: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeController', () => {
  let controller: RealtimeController;
  const mockGateway = { pushToUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [{ provide: RealtimeGateway, useValue: mockGateway }],
    }).compile();
    controller = module.get<RealtimeController>(RealtimeController);
    jest.clearAllMocks();
  });

  it('délègue au RealtimeGateway et confirme la livraison', () => {
    const result = controller.pushToUser({
      userId: 'user-1',
      event: 'notification.new',
      payload: { id: 'notif-1' },
    });

    expect(mockGateway.pushToUser).toHaveBeenCalledWith(
      'user-1',
      'notification.new',
      { id: 'notif-1' },
    );
    expect(result).toEqual({ delivered: true });
  });
});
