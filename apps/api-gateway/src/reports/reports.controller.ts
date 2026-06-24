import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { CreateReportSchema } from '@repo/contracts';
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

@ApiTags('reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject('USERS_SVC') private readonly usersSvc: ClientProxy) {}

  @Post()
  @ApiOperation({ summary: 'Signaler un profil ou une offre' })
  async create(@Req() req: AuthRequest, @Body() body: unknown) {
    const result = CreateReportSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());

    try {
      return await lastValueFrom(
        this.usersSvc.send(
          { cmd: 'report.create' },
          { reporterId: req.user.id, dto: result.data },
        ),
      );
    } catch (err: unknown) {
      toHttpException(err);
    }
  }
}
