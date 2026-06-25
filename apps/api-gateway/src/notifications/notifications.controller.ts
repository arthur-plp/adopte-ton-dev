import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { UpsertJobAlertSchema, type UpsertJobAlertDto } from '@repo/contracts';
import type { Request } from 'express';

type AuthRequest = Request & { user: AuthenticatedUser };

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

@ApiTags('notifications')
@ApiCookieAuth('better-auth.session_token')
@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.DEVELOPER, Role.RECRUITER, Role.ADMIN)
export class NotificationsController {
  constructor(
    @Inject('NOTIFICATIONS_SVC')
    private readonly notificationsClient: ClientProxy,
  ) {}

  private async send<T>(pattern: { cmd: string }, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(
        this.notificationsClient.send<T>(pattern, data),
      );
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private parseUpsertJobAlert(body: unknown): UpsertJobAlertDto {
    const result = UpsertJobAlertSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  @Get()
  @ApiOperation({ summary: 'Lister mes notifications' })
  async list(@Req() req: AuthRequest, @Query('page') page = '1') {
    return this.send(
      { cmd: 'notifications.list' },
      { userId: req.user.id, page: Math.max(1, parseInt(page, 10)) },
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiParam({ name: 'id' })
  async markRead(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'notifications.markRead' },
      { id, requesterId: req.user.id },
    );
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marquer toutes mes notifications comme lues' })
  async markAllRead(@Req() req: AuthRequest) {
    return this.send(
      { cmd: 'notifications.markAllRead' },
      { userId: req.user.id },
    );
  }

  @Get('job-alerts')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: "Récupérer mon abonnement aux alertes d'offres" })
  async getJobAlert(@Req() req: AuthRequest) {
    return this.send(
      { cmd: 'notifications.getJobAlert' },
      { developerId: req.user.id },
    );
  }

  @Post('job-alerts')
  @Roles(Role.DEVELOPER)
  @ApiOperation({
    summary: "Créer/modifier mon abonnement aux alertes d'offres",
  })
  async upsertJobAlert(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parseUpsertJobAlert(body);
    return this.send(
      { cmd: 'notifications.upsertJobAlert' },
      { developerId: req.user.id, dto },
    );
  }

  @Delete('job-alerts')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: "Supprimer mon abonnement aux alertes d'offres" })
  async deleteJobAlert(@Req() req: AuthRequest) {
    return this.send(
      { cmd: 'notifications.deleteJobAlert' },
      { developerId: req.user.id },
    );
  }
}
