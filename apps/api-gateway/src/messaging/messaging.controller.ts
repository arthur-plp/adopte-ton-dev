import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@repo/types';
import {
  CreateConversationSchema,
  SendMessageBodySchema,
  type CreateConversationDto,
} from '@repo/contracts';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { Request } from 'express';

type AuthRequest = Request & { user: AuthenticatedUser };

type ConversationSummary = {
  id: string;
  developerId: string;
  recruiterId: string;
  jobOfferId: string;
};

function toHttpException(err: unknown): never {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e['statusCode'] === 'number') {
      throw new HttpException(
        String(e['message'] ?? 'Erreur'),
        e['statusCode'],
      );
    }
    if (typeof e['message'] === 'string') {
      throw new HttpException(e['message'], 500);
    }
  }
  throw new HttpException('Erreur interne', 500);
}

@ApiTags('messaging')
@ApiCookieAuth('better-auth.session_token')
@Controller('messaging')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.DEVELOPER, Role.RECRUITER)
export class MessagingController {
  constructor(
    @Inject('MESSAGING_SVC') private readonly messagingClient: ClientProxy,
    @Inject('USERS_SVC') private readonly usersClient: ClientProxy,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private async send<T>(pattern: { cmd: string }, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(this.messagingClient.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private parseCreate(body: unknown): CreateConversationDto {
    const result = CreateConversationSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseContent(body: unknown): string {
    const result = SendMessageBodySchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data.content;
  }

  private async enrichWithOtherParticipant<T extends ConversationSummary>(
    conversation: T,
    userId: string,
  ) {
    const isDeveloper = conversation.developerId === userId;
    const otherId = isDeveloper
      ? conversation.recruiterId
      : conversation.developerId;
    const cmd = isDeveloper ? 'recruiter.getProfile' : 'developer.getProfile';
    try {
      const profile = await lastValueFrom(
        this.usersClient.send<{
          firstName: string;
          lastName: string;
          avatarUrl?: string | null;
        }>({ cmd }, { userId: otherId }),
      );
      return {
        ...conversation,
        otherParticipant: {
          id: otherId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl ?? null,
        },
      };
    } catch {
      return { ...conversation, otherParticipant: null };
    }
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Créer (ou récupérer) une conversation' })
  async createConversation(@Body() body: unknown) {
    const dto = this.parseCreate(body);
    return this.send({ cmd: 'messaging.createConversation' }, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Lister mes conversations' })
  async listConversations(@Req() req: AuthRequest) {
    const conversations = await this.send<ConversationSummary[]>(
      { cmd: 'messaging.listConversations' },
      { userId: req.user.id },
    );
    return Promise.all(
      conversations.map((c) => this.enrichWithOtherParticipant(c, req.user.id)),
    );
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: "Lister les messages d'une conversation" })
  @ApiParam({ name: 'id' })
  async getMessages(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('page') page = '1',
  ) {
    return this.send(
      { cmd: 'messaging.getMessages' },
      {
        conversationId: id,
        requesterId: req.user.id,
        page: Math.max(1, parseInt(page, 10)),
      },
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Envoyer un message' })
  @ApiParam({ name: 'id' })
  async sendMessage(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const content = this.parseContent(body);
    const message = await this.send<{ recipientId: string }>(
      { cmd: 'messaging.sendMessage' },
      { conversationId: id, senderId: req.user.id, content },
    );
    this.realtimeGateway.pushToUser(
      message.recipientId,
      'message.new',
      message,
    );
    return message;
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Marquer une conversation comme lue' })
  @ApiParam({ name: 'id' })
  async markRead(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'messaging.markRead' },
      { conversationId: id, requesterId: req.user.id },
    );
  }
}
