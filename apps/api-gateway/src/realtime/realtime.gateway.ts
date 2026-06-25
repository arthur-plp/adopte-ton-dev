import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { resolveSessionUser } from '../auth/auth-session';

/**
 * WebSocket hébergé par la Gateway (pas par messaging-svc) : seule la Gateway
 * est exposée sur Internet (CLAUDE.md §7). Canal unidirectionnel
 * serveur→client : l'envoi de message/données passe toujours par REST, le
 * WS ne sert qu'à pousser "un nouveau message/notification est arrivé".
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    const cookie = client.handshake.headers.cookie;
    const user = await resolveSessionUser(
      new Headers(cookie ? { cookie } : {}),
    );

    if (!user) {
      client.disconnect(true);
      return;
    }

    await client.join(`user:${user.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client déconnecté : ${client.id}`);
  }

  pushToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
