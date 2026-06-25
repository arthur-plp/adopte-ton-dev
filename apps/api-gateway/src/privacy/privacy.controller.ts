import {
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@repo/types';
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

// Droits RGPD (CLAUDE.md §25) : export et suppression des données de
// l'utilisateur connecté. Agrège auth-service (identité + profil) et,
// selon le rôle, jobs-svc (offres du recruteur) / applications-svc
// (candidatures du développeur) — les seules données personnelles détenues
// hors auth-service.
@ApiTags('users')
@ApiCookieAuth('better-auth.session_token')
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class PrivacyController {
  constructor(
    @Inject('USERS_SVC') private readonly usersSvc: ClientProxy,
    @Inject('JOBS_SVC') private readonly jobsSvc: ClientProxy,
    @Inject('APPLICATIONS_SVC')
    private readonly applicationsSvc: ClientProxy,
  ) {}

  private async send<T>(
    client: ClientProxy,
    pattern: { cmd: string },
    data: unknown,
  ): Promise<T> {
    try {
      return await lastValueFrom(client.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  @Get('me/export')
  @ApiOperation({
    summary: 'Exporter mes données personnelles (RGPD, droit à la portabilité)',
  })
  async exportMyData(@Req() req: AuthRequest) {
    const identity = await this.send(
      this.usersSvc,
      { cmd: 'users.exportData' },
      { userId: req.user.id },
    );

    const [jobOffers, applications] = await Promise.all([
      req.user.role === Role.RECRUITER
        ? this.send(
            this.jobsSvc,
            { cmd: 'job.findMine' },
            { recruiterId: req.user.id },
          )
        : Promise.resolve(null),
      req.user.role === Role.DEVELOPER
        ? this.send(
            this.applicationsSvc,
            { cmd: 'application.findMine' },
            { developerId: req.user.id },
          )
        : Promise.resolve(null),
    ]);

    return { identity, jobOffers, applications };
  }

  @Delete('me')
  @ApiOperation({
    summary: "Supprimer définitivement mon compte (RGPD, droit à l'effacement)",
  })
  async deleteMyAccount(@Req() req: AuthRequest) {
    return this.send(
      this.usersSvc,
      { cmd: 'users.deleteOwnAccount' },
      { userId: req.user.id },
    );
  }
}
