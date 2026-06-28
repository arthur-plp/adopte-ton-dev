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
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@repo/types';
import {
  AdminCreateJobOfferSchema,
  UpdateJobOfferSchema,
  AdminSetPlanSchema,
  UpdateApplicationStatusSchema,
  type AdminCreateJobOfferDto,
  type UpdateJobOfferDto,
  type UpdateApplicationStatusDto,
  type AdminSetPlanDto,
} from '@repo/contracts';
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

@ApiTags('admin')
@ApiCookieAuth('better-auth.session_token')
@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    @Inject('USERS_SVC') private readonly usersSvc: ClientProxy,
    @Inject('JOBS_SVC') private readonly jobsSvc: ClientProxy,
    @Inject('APPLICATIONS_SVC')
    private readonly applicationsSvc: ClientProxy,
    @Inject('PAYMENT_SVC') private readonly paymentSvc: ClientProxy,
  ) {}

  private async send<T>(pattern: { cmd: string }, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(this.usersSvc.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private async sendJobs<T>(
    pattern: { cmd: string },
    data: unknown,
  ): Promise<T> {
    try {
      return await lastValueFrom(this.jobsSvc.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private async sendApplications<T>(
    pattern: { cmd: string },
    data: unknown,
  ): Promise<T> {
    try {
      return await lastValueFrom(this.applicationsSvc.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private async sendPayment<T>(
    pattern: { cmd: string },
    data: unknown,
  ): Promise<T> {
    try {
      return await lastValueFrom(this.paymentSvc.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private parseAdminCreate(body: unknown): AdminCreateJobOfferDto {
    const result = AdminCreateJobOfferSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseUpdate(body: unknown): UpdateJobOfferDto {
    const result = UpdateJobOfferSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseUpdateStatus(body: unknown): UpdateApplicationStatusDto {
    const result = UpdateApplicationStatusSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseSetPlan(body: unknown): AdminSetPlanDto {
    const result = AdminSetPlanSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques globales de la plateforme' })
  async getStats() {
    const [users, jobOffers, applications] = await Promise.all([
      this.send({ cmd: 'admin.getStats' }, {}),
      this.sendJobs({ cmd: 'job.getStats' }, {}),
      this.sendApplications({ cmd: 'application.getStats' }, {}),
    ]);
    return { users, jobOffers, applications };
  }

  @Get('users')
  @ApiOperation({
    summary: 'Lister tous les utilisateurs (paginé + recherche + filtre rôle)',
  })
  listUsers(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.send(
      { cmd: 'admin.listUsers' },
      {
        page: Math.max(1, parseInt(page, 10)),
        pageSize: Math.min(100, parseInt(pageSize, 10)),
        search: search?.trim() || undefined,
        role: role || undefined,
      },
    );
  }

  @Post('users/:userId/promote-recruiter')
  @ApiOperation({ summary: 'Promouvoir un utilisateur en recruteur' })
  promoteToRecruiter(
    @Param('userId') userId: string,
    @Body()
    body: {
      companyName: string;
      companySiret?: string;
      firstName: string;
      lastName: string;
    },
  ) {
    return this.send({ cmd: 'admin.promoteToRecruiter' }, { userId, ...body });
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Modifier un utilisateur (nom, rôle)' })
  updateUser(
    @Param('userId') userId: string,
    @Body() body: { name?: string; role?: string },
  ) {
    return this.send({ cmd: 'admin.updateUser' }, { userId, ...body });
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  deleteUser(@Param('userId') userId: string) {
    return this.send({ cmd: 'admin.deleteUser' }, { userId });
  }

  // ── Modération des offres ─────────────────────────────────────────────────

  @Get('job-offers')
  @ApiOperation({ summary: 'Lister les offres en attente de validation' })
  listPendingOffers(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.sendJobs(
      { cmd: 'job.findPendingReview' },
      {
        page: Math.max(1, parseInt(page, 10)),
        pageSize: Math.min(100, parseInt(pageSize, 10)),
      },
    );
  }

  @Post('job-offers/:id/approve')
  @ApiOperation({ summary: 'Approuver une offre' })
  approveOffer(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sendJobs({ cmd: 'job.approve' }, { id, adminId: req.user.id });
  }

  @Post('job-offers/:id/reject')
  @ApiOperation({ summary: 'Rejeter une offre' })
  rejectOffer(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.sendJobs(
      { cmd: 'job.reject' },
      { id, reason: body.reason, adminId: req.user.id },
    );
  }

  @Get('job-offers/:id/history')
  @ApiOperation({ summary: "Historique des transitions de statut d'une offre" })
  getOfferHistory(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sendJobs(
      { cmd: 'job.getHistory' },
      { id, requesterId: req.user.id, isAdmin: true },
    );
  }

  // ── Gestion des offres (CRUD complet, indépendant de la modération) ──────

  @Get('job-offers/manage')
  @ApiOperation({
    summary: 'Lister toutes les offres (tous statuts, paginé + recherche)',
  })
  listAllOffers(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.sendJobs(
      { cmd: 'job.findAllForAdmin' },
      {
        page: Math.max(1, parseInt(page, 10)),
        pageSize: Math.min(100, parseInt(pageSize, 10)),
        status: status || undefined,
        search: search?.trim() || undefined,
      },
    );
  }

  @Post('job-offers')
  @ApiOperation({ summary: "Créer une offre pour le compte d'un recruteur" })
  async createOffer(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parseAdminCreate(body);
    const { recruiterId, companyId, companyName, ...rest } = dto;
    return this.sendJobs(
      { cmd: 'job.create' },
      {
        recruiterId,
        companyId,
        companyName,
        dto: rest,
        actor: { role: 'ADMIN', id: req.user.id },
      },
    );
  }

  @Patch('job-offers/:id')
  @ApiOperation({ summary: 'Modifier une offre (bypass propriétaire)' })
  async updateOffer(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseUpdate(body);
    return this.sendJobs(
      { cmd: 'job.update' },
      { id, recruiterId: req.user.id, dto, isAdmin: true },
    );
  }

  @Delete('job-offers/:id')
  @ApiOperation({ summary: 'Supprimer une offre (bypass propriétaire)' })
  deleteOffer(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sendJobs(
      { cmd: 'job.delete' },
      { id, recruiterId: req.user.id, isAdmin: true },
    );
  }

  @Post('job-offers/:id/archive')
  @ApiOperation({ summary: 'Archiver une offre (bypass propriétaire)' })
  archiveOffer(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sendJobs(
      { cmd: 'job.archive' },
      { id, recruiterId: req.user.id, isAdmin: true },
    );
  }

  @Get('job-offers/:id/applications-count')
  @ApiOperation({
    summary:
      'Nombre de candidatures liées à une offre (affiché avant archivage/suppression)',
  })
  getOfferApplicationsCount(@Param('id') id: string) {
    return this.sendApplications(
      { cmd: 'application.countByJobOffer' },
      { jobOfferId: id },
    );
  }

  @Get('applications')
  @ApiOperation({
    summary:
      'Lister les candidatures (paginé, filtrable par offre et/ou statut, lecture admin sans effet de bord)',
  })
  listApplications(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
    @Query('jobOfferId') jobOfferId?: string,
  ) {
    return this.sendApplications(
      { cmd: 'application.findAllForAdmin' },
      {
        page: Math.max(1, parseInt(page, 10)),
        pageSize: Math.min(100, parseInt(pageSize, 10)),
        status: status || undefined,
        jobOfferId: jobOfferId || undefined,
      },
    );
  }

  @Patch('applications/:id/status')
  @ApiOperation({
    summary: "Changer le statut d'une candidature (bypass propriétaire)",
  })
  async updateApplicationStatus(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseUpdateStatus(body);
    return this.sendApplications(
      { cmd: 'application.updateStatus' },
      { id, recruiterId: req.user.id, dto, isAdmin: true },
    );
  }

  // ── Abonnements ──────────────────────────────────────────────────────────

  @Get('companies')
  @ApiOperation({
    summary: "Lister les entreprises avec leur plan d'abonnement",
  })
  async listCompanies(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search?: string,
  ) {
    const companies = await this.send<{
      data: { id: string; name: string; siret: string | null }[];
      total: number;
      page: number;
      pageSize: number;
    }>(
      { cmd: 'admin.listCompanies' },
      {
        page: Math.max(1, parseInt(page, 10)),
        pageSize: Math.min(100, parseInt(pageSize, 10)),
        search: search?.trim() || undefined,
      },
    );
    const data = await Promise.all(
      companies.data.map(async (company) => {
        try {
          const subscription = await this.sendPayment<{
            plan: string;
            status: string;
            currentPeriodEnd: string | null;
          }>({ cmd: 'payment.getSubscription' }, { companyId: company.id });
          return { ...company, subscription };
        } catch {
          return { ...company, subscription: null };
        }
      }),
    );
    return { ...companies, data };
  }

  @Patch('companies/:companyId/plan')
  @ApiOperation({ summary: "Forcer le plan d'une entreprise (override admin)" })
  async setCompanyPlan(
    @Param('companyId') companyId: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseSetPlan(body);
    return this.sendPayment(
      { cmd: 'payment.adminSetPlan' },
      { companyId, plan: dto.plan },
    );
  }

  // ── Signalements ────────────────────────────────────────────────────────

  @Get('reports')
  @ApiOperation({ summary: 'Lister les signalements (paginé + filtre statut)' })
  listReports(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.send(
      { cmd: 'report.list' },
      {
        status: status || undefined,
        page: Math.max(1, parseInt(page, 10)),
        pageSize: Math.min(100, parseInt(pageSize, 10)),
      },
    );
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: "Changer le statut d'un signalement" })
  updateReportStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.send(
      { cmd: 'report.updateStatus' },
      { id, status: body.status },
    );
  }
}
