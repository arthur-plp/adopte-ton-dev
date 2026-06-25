// Mock auth.guard + auth-session before imports to avoid loading better-auth
// (ESM-only) in Jest — RealtimeGateway importe auth-session transitivement.
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('../auth/auth-session', () => ({
  resolveSessionUser: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { HttpException } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeGateway } from '../realtime/realtime.gateway';
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

const mockMessagingClient = { send: jest.fn() };
const mockUsersClient = { send: jest.fn() };
const mockRealtimeGateway = { pushToUser: jest.fn() };

const VALID_CUID = 'clxxxxxxxxxxxxxxxxxxxxxxxx';

const conversation = {
  id: 'conv-1',
  developerId: 'dev-1',
  recruiterId: 'recruiter-1',
  jobOfferId: '',
};

describe('MessagingController (api-gateway)', () => {
  let controller: MessagingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        { provide: 'MESSAGING_SVC', useValue: mockMessagingClient },
        { provide: 'USERS_SVC', useValue: mockUsersClient },
        { provide: RealtimeGateway, useValue: mockRealtimeGateway },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagingController>(MessagingController);
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('transmet la création au messaging-svc', async () => {
      mockMessagingClient.send.mockReturnValueOnce(of(conversation));

      const result = await controller.createConversation({
        recruiterId: VALID_CUID,
        developerId: VALID_CUID,
      });

      expect(mockMessagingClient.send).toHaveBeenCalledWith(
        { cmd: 'messaging.createConversation' },
        { recruiterId: VALID_CUID, developerId: VALID_CUID },
      );
      expect(result).toEqual(conversation);
    });

    it('lance HttpException 400 si payload invalide', async () => {
      await expect(
        controller.createConversation({ recruiterId: '' } as never),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('listConversations', () => {
    it("enrichit chaque conversation avec le profil de l'autre participant", async () => {
      mockMessagingClient.send.mockReturnValueOnce(of([conversation]));
      mockUsersClient.send.mockReturnValueOnce(
        of({ firstName: 'Bob', lastName: 'Recruteur', avatarUrl: null }),
      );

      const result = await controller.listConversations(mockReq(mockDeveloper));

      expect(mockUsersClient.send).toHaveBeenCalledWith(
        { cmd: 'recruiter.getProfile' },
        { userId: 'recruiter-1' },
      );
      expect(result).toEqual([
        {
          ...conversation,
          otherParticipant: {
            id: 'recruiter-1',
            firstName: 'Bob',
            lastName: 'Recruteur',
            avatarUrl: null,
          },
        },
      ]);
    });

    it("retourne otherParticipant: null si l'enrichissement échoue", async () => {
      mockMessagingClient.send.mockReturnValueOnce(of([conversation]));
      mockUsersClient.send.mockReturnValueOnce(
        throwError(() => new Error('unreachable')),
      );

      const result = await controller.listConversations(mockReq(mockDeveloper));

      expect(result).toEqual([{ ...conversation, otherParticipant: null }]);
    });
  });

  describe('getMessages', () => {
    it('transmet conversationId/requesterId/page au messaging-svc', async () => {
      mockMessagingClient.send.mockReturnValueOnce(
        of({ data: [], total: 0, page: 1, pageSize: 50 }),
      );

      await controller.getMessages(mockReq(mockDeveloper), 'conv-1', '2');

      expect(mockMessagingClient.send).toHaveBeenCalledWith(
        { cmd: 'messaging.getMessages' },
        { conversationId: 'conv-1', requesterId: 'dev-1', page: 2 },
      );
    });
  });

  describe('sendMessage', () => {
    it('valide et transmet le contenu au messaging-svc', async () => {
      mockMessagingClient.send.mockReturnValueOnce(
        of({ id: 'm1', recipientId: 'recruiter-1' }),
      );

      await controller.sendMessage(mockReq(mockDeveloper), 'conv-1', {
        content: 'Salut',
      });

      expect(mockMessagingClient.send).toHaveBeenCalledWith(
        { cmd: 'messaging.sendMessage' },
        { conversationId: 'conv-1', senderId: 'dev-1', content: 'Salut' },
      );
    });

    it('pousse le message en temps réel au destinataire', async () => {
      const message = {
        id: 'm1',
        recipientId: 'recruiter-1',
        content: 'Salut',
      };
      mockMessagingClient.send.mockReturnValueOnce(of(message));

      await controller.sendMessage(mockReq(mockDeveloper), 'conv-1', {
        content: 'Salut',
      });

      expect(mockRealtimeGateway.pushToUser).toHaveBeenCalledWith(
        'recruiter-1',
        'message.new',
        message,
      );
    });

    it('lance HttpException 400 si le contenu est vide', async () => {
      await expect(
        controller.sendMessage(mockReq(mockDeveloper), 'conv-1', {
          content: '',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('markRead', () => {
    it('transmet conversationId/requesterId au messaging-svc', async () => {
      mockMessagingClient.send.mockReturnValueOnce(of({ updated: 1 }));

      await controller.markRead(mockReq(mockDeveloper), 'conv-1');

      expect(mockMessagingClient.send).toHaveBeenCalledWith(
        { cmd: 'messaging.markRead' },
        { conversationId: 'conv-1', requesterId: 'dev-1' },
      );
    });
  });
});
