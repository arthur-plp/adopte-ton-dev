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
  UpdateDeveloperProfileSchema,
  UpdateRecruiterProfileSchema,
  TechnologySchema,
  SkillSchema,
  ProjectSchema,
  UpdateProjectSchema,
  UpdateLevelSchema,
  type UpdateDeveloperProfileDto,
  type UpdateRecruiterProfileDto,
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

interface ParseableSchema<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { flatten(): object } };
}

@ApiTags('users')
@ApiCookieAuth('better-auth.session_token')
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(@Inject('USERS_SVC') private readonly usersSvc: ClientProxy) {}

  private async send<T>(pattern: { cmd: string }, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(this.usersSvc.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private parse<T>(schema: ParseableSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  // ── Auth / onboarding ─────────────────────────────────────────────────────

  @Post('onboarding')
  @ApiOperation({
    summary: 'Choisir son rôle (DEVELOPER / RECRUITER) — 1 seule fois',
  })
  async onboarding(@Req() req: AuthRequest, @Body() body: { role: Role }) {
    const nameParts = req.user.name.trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || (nameParts[0] ?? '');
    return this.send(
      { cmd: 'users.onboarding' },
      {
        userId: req.user.id,
        role: body.role,
        firstName,
        lastName,
      },
    );
  }

  @Get('me/profile')
  @ApiOperation({ summary: "Profil complet de l'utilisateur connecté" })
  async getMyProfile(@Req() req: AuthRequest) {
    return this.send({ cmd: 'users.getProfile' }, { userId: req.user.id });
  }

  @Get('me/avatar-options')
  @ApiOperation({ summary: 'Avatars disponibles (providers OAuth liés)' })
  async getAvatarOptions(@Req() req: AuthRequest) {
    return this.send(
      { cmd: 'users.getAvatarOptions' },
      { userId: req.user.id },
    );
  }

  // ── Profil développeur ────────────────────────────────────────────────────

  @Get('developer/:userId')
  @ApiOperation({ summary: "Profil public d'un développeur" })
  @ApiParam({ name: 'userId' })
  async getDeveloperProfile(@Param('userId') userId: string) {
    return this.send({ cmd: 'developer.getProfile' }, { userId });
  }

  @Patch('developer/me')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Mettre à jour son profil développeur' })
  async updateDeveloperProfile(
    @Req() req: AuthRequest,
    @Body() data: UpdateDeveloperProfileDto,
  ) {
    const dto = this.parse(UpdateDeveloperProfileSchema, data);
    return this.send(
      { cmd: 'developer.updateProfile' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        data: dto,
      },
    );
  }

  @Post('developer/me/github-sync')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Synchroniser les repos GitHub' })
  async syncGitHub(@Req() req: AuthRequest) {
    return this.send({ cmd: 'developer.githubSync' }, { userId: req.user.id });
  }

  // ── Profil recruteur ──────────────────────────────────────────────────────

  @Get('recruiter/me')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Profil complet du recruteur connecté' })
  async getMyRecruiterProfile(@Req() req: AuthRequest) {
    return this.send({ cmd: 'recruiter.getProfile' }, { userId: req.user.id });
  }

  @Patch('recruiter/me')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: 'Mettre à jour son profil recruteur' })
  async updateRecruiterProfile(
    @Req() req: AuthRequest,
    @Body() data: UpdateRecruiterProfileDto,
  ) {
    const dto = this.parse(UpdateRecruiterProfileSchema, data);
    return this.send(
      { cmd: 'recruiter.updateProfile' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        data: dto,
      },
    );
  }

  // ── Technologies ──────────────────────────────────────────────────────────

  @Get('developer/me/technologies')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Lister mes technologies' })
  async getMyTechnologies(@Req() req: AuthRequest) {
    return this.send(
      { cmd: 'developer.getTechnologies' },
      { userId: req.user.id },
    );
  }

  @Post('developer/me/technologies')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Ajouter une technologie' })
  async addTechnology(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parse(TechnologySchema, body);
    return this.send(
      { cmd: 'developer.addTechnology' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        ...dto,
      },
    );
  }

  @Patch('developer/me/technologies/:techId')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: "Modifier le niveau d'une technologie" })
  @ApiParam({ name: 'techId' })
  async updateTechnology(
    @Req() req: AuthRequest,
    @Param('techId') techId: string,
    @Body() body: unknown,
  ) {
    const { level } = this.parse(UpdateLevelSchema, body);
    return this.send(
      { cmd: 'developer.updateTechnology' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        techId,
        level,
      },
    );
  }

  @Delete('developer/me/technologies/:techId')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Supprimer une technologie' })
  @ApiParam({ name: 'techId' })
  async deleteTechnology(
    @Req() req: AuthRequest,
    @Param('techId') techId: string,
  ) {
    return this.send(
      { cmd: 'developer.deleteTechnology' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        techId,
      },
    );
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  @Get('skills/catalog')
  @ApiOperation({ summary: 'Catalogue de compétences disponibles' })
  async listSkillsCatalog() {
    return this.send({ cmd: 'developer.getSkillsCatalog' }, {});
  }

  @Get('developer/me/skills')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Lister mes compétences' })
  async getMySkills(@Req() req: AuthRequest) {
    return this.send({ cmd: 'developer.getSkills' }, { userId: req.user.id });
  }

  @Post('developer/me/skills')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Ajouter une compétence' })
  async addSkill(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parse(SkillSchema, body);
    return this.send(
      { cmd: 'developer.addSkill' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        ...dto,
      },
    );
  }

  @Patch('developer/me/skills/:skillId')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: "Modifier le niveau d'une compétence" })
  @ApiParam({ name: 'skillId' })
  async updateSkill(
    @Req() req: AuthRequest,
    @Param('skillId') skillId: string,
    @Body() body: unknown,
  ) {
    const { level } = this.parse(UpdateLevelSchema, body);
    return this.send(
      { cmd: 'developer.updateSkill' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        skillId,
        level,
      },
    );
  }

  @Delete('developer/me/skills/:skillId')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Retirer une compétence' })
  @ApiParam({ name: 'skillId' })
  async removeSkill(
    @Req() req: AuthRequest,
    @Param('skillId') skillId: string,
  ) {
    return this.send(
      { cmd: 'developer.removeSkill' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        skillId,
      },
    );
  }

  // ── Projets ───────────────────────────────────────────────────────────────

  @Get('developer/me/projects')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Lister mes projets' })
  async getMyProjects(@Req() req: AuthRequest) {
    return this.send({ cmd: 'developer.getProjects' }, { userId: req.user.id });
  }

  @Post('developer/me/projects')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Créer un projet manuellement' })
  async createProject(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parse(ProjectSchema, body);
    return this.send(
      { cmd: 'developer.createProject' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        ...dto,
      },
    );
  }

  @Post('developer/me/projects/reorder')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Réordonner les projets' })
  async reorderMyProjects(
    @Req() req: AuthRequest,
    @Body() body: { order: { id: string; displayOrder: number }[] },
  ) {
    return this.send(
      { cmd: 'developer.reorderProjects' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        order: body.order,
      },
    );
  }

  @Patch('developer/me/projects/:projectId')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Modifier un projet' })
  @ApiParam({ name: 'projectId' })
  async updateMyProject(
    @Req() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const dto = this.parse(UpdateProjectSchema, body);
    return this.send(
      { cmd: 'developer.updateProject' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        projectId,
        ...dto,
      },
    );
  }

  @Delete('developer/me/projects/:projectId')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Supprimer un projet' })
  @ApiParam({ name: 'projectId' })
  async deleteMyProject(
    @Req() req: AuthRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.send(
      { cmd: 'developer.deleteProject' },
      {
        userId: req.user.id,
        requesterId: req.user.id,
        projectId,
      },
    );
  }
}
