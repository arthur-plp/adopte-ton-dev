import {
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
  BadRequestException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OptionalAuth } from '../auth/optional-auth.decorator';
import { Role } from '@repo/types';
import {
  CreateJobOfferSchema,
  UpdateJobOfferSchema,
  JobOfferFiltersSchema,
  type CreateJobOfferDto,
  type UpdateJobOfferDto,
  type JobOfferFiltersDto,
} from '@repo/contracts';
import type { Request } from 'express';

type AuthRequest = Request & { user: AuthenticatedUser };
type OptionalAuthRequest = Request & { user?: AuthenticatedUser };

type RecruiterProfileResponse = {
  role: string;
  profile: {
    companyId: string;
    company: { id: string; name: string } | null;
  } | null;
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

@ApiTags('job-offers')
@ApiCookieAuth('better-auth.session_token')
@Controller('job-offers')
@UseGuards(AuthGuard, RolesGuard)
export class JobOffersController {
  constructor(
    @Inject('JOBS_SVC') private readonly jobsClient: ClientProxy,
    @Inject('USERS_SVC') private readonly usersClient: ClientProxy,
  ) {}

  private async send<T>(pattern: { cmd: string }, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(this.jobsClient.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private async sendUsers<T>(
    pattern: { cmd: string },
    data: unknown,
  ): Promise<T> {
    try {
      return await lastValueFrom(this.usersClient.send<T>(pattern, data));
    } catch {
      return { profile: null } as T;
    }
  }

  private parseCreate(body: unknown): CreateJobOfferDto {
    const result = CreateJobOfferSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseUpdate(body: unknown): UpdateJobOfferDto {
    const result = UpdateJobOfferSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseFilters(query: unknown): JobOfferFiltersDto {
    const result = JobOfferFiltersSchema.safeParse(query);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  // ── Recruteur ─────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Créer une offre (DRAFT)' })
  async create(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parseCreate(body);
    const profileData = await this.sendUsers<RecruiterProfileResponse>(
      { cmd: 'users.getProfile' },
      { userId: req.user.id },
    );
    const companyId =
      profileData.profile?.companyId ?? req.user.companyId ?? '';
    const companyName = profileData.profile?.company?.name;
    return this.send(
      { cmd: 'job.create' },
      { recruiterId: req.user.id, companyId, companyName, dto },
    );
  }

  @Get('mine')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Lister mes offres' })
  async findMine(@Req() req: AuthRequest) {
    return this.send({ cmd: 'job.findMine' }, { recruiterId: req.user.id });
  }

  @Patch(':id')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Modifier une offre' })
  @ApiParam({ name: 'id' })
  async update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseUpdate(body);
    return this.send(
      { cmd: 'job.update' },
      { id, recruiterId: req.user.id, dto },
    );
  }

  @Post(':id/publish')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: "Soumettre une offre pour validation par l'admin" })
  @ApiParam({ name: 'id' })
  async publish(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send({ cmd: 'job.publish' }, { id, recruiterId: req.user.id });
  }

  @Post(':id/go-live')
  @Roles(Role.RECRUITER)
  @ApiOperation({
    summary: 'Publier une offre approuvée (la rendre visible publiquement)',
  })
  @ApiParam({ name: 'id' })
  async goLive(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send({ cmd: 'job.goLive' }, { id, recruiterId: req.user.id });
  }

  @Post(':id/archive')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Archiver une offre' })
  @ApiParam({ name: 'id' })
  async archive(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send({ cmd: 'job.archive' }, { id, recruiterId: req.user.id });
  }

  @Post(':id/unarchive')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Désarchiver une offre (la repasser en brouillon)' })
  @ApiParam({ name: 'id' })
  async unarchive(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'job.unarchive' },
      { id, recruiterId: req.user.id },
    );
  }

  @Delete(':id')
  @Roles(Role.RECRUITER)
  @ApiOperation({
    summary: 'Supprimer une offre (DRAFT ou ARCHIVED uniquement)',
  })
  @ApiParam({ name: 'id' })
  async delete(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send({ cmd: 'job.delete' }, { id, recruiterId: req.user.id });
  }

  @Post(':id/reset-to-draft')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Repasser une offre rejetée en brouillon' })
  @ApiParam({ name: 'id' })
  async resetToDraft(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'job.resetToDraft' },
      { id, recruiterId: req.user.id },
    );
  }

  @Get(':id/history')
  @Roles(Role.RECRUITER)
  @ApiOperation({
    summary: 'Historique des transitions de statut de mon offre',
  })
  @ApiParam({ name: 'id' })
  async getHistory(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'job.getHistory' },
      { id, requesterId: req.user.id, isAdmin: false },
    );
  }

  // ── Public ────────────────────────────────────────────────────────────────

  @Get()
  @OptionalAuth()
  @ApiOperation({ summary: 'Lister les offres publiées (paginé)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'remoteOk', required: false })
  @ApiQuery({ name: 'location', required: false })
  @ApiQuery({ name: 'technologies', required: false, isArray: true })
  async findPublished(
    @Query() rawQuery: unknown,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const filters = this.parseFilters(rawQuery);
    return this.send(
      { cmd: 'job.findPublished' },
      {
        filters,
        page: Math.max(1, parseInt(page, 10)),
        pageSize: Math.min(100, parseInt(pageSize, 10)),
      },
    );
  }

  @Get(':id')
  @OptionalAuth()
  @ApiOperation({ summary: "Détail d'une offre (publique si PUBLISHED)" })
  @ApiParam({ name: 'id' })
  async findOne(@Req() req: OptionalAuthRequest, @Param('id') id: string) {
    const publicOnly = !req.user;
    return this.send({ cmd: 'job.findOne' }, { id, publicOnly });
  }
}
