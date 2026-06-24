import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
} from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@repo/types';
import {
  CreateApplicationSchema,
  UpdateApplicationStatusSchema,
  CreateDocumentRequestSchema,
  CreateUploadUrlSchema,
  ConfirmUploadSchema,
  type CreateApplicationDto,
  type UpdateApplicationStatusDto,
  type CreateDocumentRequestDto,
  type CreateUploadUrlDto,
  type ConfirmUploadDto,
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

@ApiTags('applications')
@ApiCookieAuth('better-auth.session_token')
@Controller('applications')
@UseGuards(AuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(
    @Inject('APPLICATIONS_SVC')
    private readonly applicationsClient: ClientProxy,
  ) {}

  private async send<T>(pattern: { cmd: string }, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(
        this.applicationsClient.send<T>(pattern, data),
      );
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private parseCreate(body: unknown): CreateApplicationDto {
    const result = CreateApplicationSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseUpdateStatus(body: unknown): UpdateApplicationStatusDto {
    const result = UpdateApplicationStatusSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseCreateDocumentRequest(body: unknown): CreateDocumentRequestDto {
    const result = CreateDocumentRequestSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseCreateUploadUrl(body: unknown): CreateUploadUrlDto {
    const result = CreateUploadUrlSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseConfirmUpload(body: unknown): ConfirmUploadDto {
    const result = ConfirmUploadSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  // ── Développeur ───────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Postuler à une offre publiée' })
  async create(@Req() req: AuthRequest, @Body() body: unknown) {
    if (!req.user.emailVerified) {
      throw new ForbiddenException(
        'Confirme ton adresse email avant de postuler.',
      );
    }
    const dto = this.parseCreate(body);
    return this.send(
      { cmd: 'application.create' },
      { developerId: req.user.id, dto },
    );
  }

  @Get('mine')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Lister mes candidatures' })
  async findMine(@Req() req: AuthRequest) {
    return this.send(
      { cmd: 'application.findMine' },
      { developerId: req.user.id },
    );
  }

  @Post(':id/withdraw')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Retirer ma candidature' })
  @ApiParam({ name: 'id' })
  async withdraw(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'application.withdraw' },
      { id, developerId: req.user.id },
    );
  }

  @Post(':id/reactivate')
  @Roles(Role.DEVELOPER)
  @ApiOperation({
    summary:
      "Réactiver une candidature retirée (impossible si l'offre n'est plus publiée ou si elle a été rejetée)",
  })
  @ApiParam({ name: 'id' })
  async reactivate(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'application.reactivate' },
      { id, developerId: req.user.id },
    );
  }

  // ── Recruteur ─────────────────────────────────────────────────────────────

  @Get('job-offer/:jobOfferId')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: "Lister les candidatures d'une offre" })
  @ApiParam({ name: 'jobOfferId' })
  async findByJobOffer(
    @Req() req: AuthRequest,
    @Param('jobOfferId') jobOfferId: string,
  ) {
    return this.send(
      { cmd: 'application.findByJobOffer' },
      { jobOfferId, recruiterId: req.user.id },
    );
  }

  @Patch(':id/status')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: "Changer le statut d'une candidature" })
  @ApiParam({ name: 'id' })
  async updateStatus(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseUpdateStatus(body);
    return this.send(
      { cmd: 'application.updateStatus' },
      { id, recruiterId: req.user.id, dto },
    );
  }

  // ── Commun (dev propriétaire ou recruteur propriétaire de l'offre) ───────

  @Get(':id/history')
  @ApiOperation({ summary: "Historique des statuts d'une candidature" })
  @ApiParam({ name: 'id' })
  async getHistory(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'application.getHistory' },
      {
        id,
        requesterId: req.user.id,
        requesterRole: req.user.role,
        isAdmin: req.user.role === Role.ADMIN,
      },
    );
  }

  // ── Pièces justificatives ───────────────────────────────────────────────

  @Post(':id/document-requests')
  @Roles(Role.RECRUITER, Role.DEVELOPER)
  @ApiOperation({
    summary:
      'Demander une pièce justificative au candidat (recruteur) ou joindre spontanément un document (développeur)',
  })
  @ApiParam({ name: 'id' })
  async createDocumentRequest(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseCreateDocumentRequest(body);
    return this.send(
      { cmd: 'application.documentRequest.create' },
      {
        applicationId: id,
        requesterId: req.user.id,
        requesterRole: req.user.role,
        dto,
      },
    );
  }

  @Get(':id/document-requests')
  @ApiOperation({
    summary: "Lister les pièces justificatives d'une candidature",
  })
  @ApiParam({ name: 'id' })
  async listDocumentRequests(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.send(
      { cmd: 'application.documentRequest.list' },
      {
        applicationId: id,
        requesterId: req.user.id,
        requesterRole: req.user.role,
      },
    );
  }

  @Post('document-requests/:requestId/upload-url')
  @Roles(Role.DEVELOPER)
  @ApiOperation({
    summary: "Obtenir une URL d'upload pour déposer un document",
  })
  @ApiParam({ name: 'requestId' })
  async createUploadUrl(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseCreateUploadUrl(body);
    return this.send(
      { cmd: 'application.documentRequest.createUploadUrl' },
      { requestId, developerId: req.user.id, dto },
    );
  }

  @Post('document-requests/:requestId/confirm')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: "Confirmer le dépôt d'un document" })
  @ApiParam({ name: 'requestId' })
  async confirmUpload(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ) {
    const dto = this.parseConfirmUpload(body);
    return this.send(
      { cmd: 'application.documentRequest.confirmUpload' },
      { requestId, developerId: req.user.id, dto },
    );
  }

  @Get('document-requests/:requestId/download-url')
  @ApiOperation({
    summary:
      "Obtenir une URL de téléchargement (ou d'aperçu) d'un document déposé",
  })
  @ApiParam({ name: 'requestId' })
  async getDownloadUrl(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
    @Query('disposition') disposition?: string,
  ) {
    return this.send(
      { cmd: 'application.documentRequest.downloadUrl' },
      {
        requestId,
        requesterId: req.user.id,
        requesterRole: req.user.role,
        disposition: disposition === 'inline' ? 'inline' : 'attachment',
      },
    );
  }

  @Delete('document-requests/:requestId')
  @Roles(Role.DEVELOPER)
  @ApiOperation({
    summary:
      'Supprimer un document déposé (le développeur ne peut supprimer que ses propres fichiers)',
  })
  @ApiParam({ name: 'requestId' })
  async deleteDocument(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
  ) {
    return this.send(
      { cmd: 'application.documentRequest.delete' },
      { requestId, developerId: req.user.id },
    );
  }
}
