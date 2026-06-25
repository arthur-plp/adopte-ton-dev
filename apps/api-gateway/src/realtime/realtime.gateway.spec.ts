jest.mock('../auth/auth-session', () => ({
  resolveSessionUser: jest.fn(),
}));

import { RealtimeGateway } from './realtime.gateway';
import { resolveSessionUser } from '../auth/auth-session';
import type { Socket, Server } from 'socket.io';

const mockResolveSessionUser = resolveSessionUser as jest.Mock;

function buildMockSocket(cookie?: string): Socket {
  return {
    id: 'socket-1',
    handshake: { headers: { cookie } },
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  } as unknown as Socket;
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RealtimeGateway();
  });

  describe('handleConnection', () => {
    it('rejette (déconnecte) un client sans session valide', async () => {
      mockResolveSessionUser.mockResolvedValue(null);
      const client = buildMockSocket('cookie-invalide');

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('fait rejoindre la room user:<id> à un client authentifié', async () => {
      mockResolveSessionUser.mockResolvedValue({ id: 'user-1' });
      const client = buildMockSocket('better-auth.session_token=abc');

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:user-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('pushToUser', () => {
    it("émet l'event sur la room de l'utilisateur ciblé", () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as unknown as Server;

      gateway.pushToUser('user-1', 'message.new', { foo: 'bar' });

      expect(to).toHaveBeenCalledWith('user:user-1');
      expect(emit).toHaveBeenCalledWith('message.new', { foo: 'bar' });
    });
  });
});
