import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  HttpCode,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@repo/types';
import {
  UpdateDeveloperProfileSchema,
  TechnologySchema,
  SkillSchema,
  ProjectSchema,
  UpdateProjectSchema,
  UpdateLevelSchema,
  type UpdateDeveloperProfileDto,
} from '@repo/contracts';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

type AuthRequest = Request & { user: AuthenticatedUser };

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
  private readonly usersSvcUrl: string;

  constructor(config: ConfigService) {
    this.usersSvcUrl = config.get<string>(
      'USERS_SVC_URL',
      'http://localhost:3001',
    );
  }

  private parse<T>(schema: ParseableSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private fwd(url: string, method = 'GET', body?: object) {
    return fetch(`${this.usersSvcUrl}${url}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json());
  }

  // ── Auth / onboarding ─────────────────────────────────────────────────────

  @Post('onboarding')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Choisir son rôle (DEVELOPER / RECRUITER) — 1 seule fois',
  })
  async onboarding(@Req() req: AuthRequest, @Body() body: { role: Role }) {
    const nameParts = req.user.name.trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || (nameParts[0] ?? '');
    return this.fwd('/api/v1/users/onboarding', 'POST', {
      userId: req.user.id,
      role: body.role,
      firstName,
      lastName,
    });
  }

  @Get('me/profile')
  @ApiOperation({ summary: "Profil complet de l'utilisateur connecté" })
  async getMyProfile(@Req() req: AuthRequest) {
    return this.fwd(`/api/v1/users/${req.user.id}/profile`);
  }

  @Get('me/avatar-options')
  @ApiOperation({ summary: 'Avatars disponibles (providers OAuth liés)' })
  async getAvatarOptions(@Req() req: AuthRequest) {
    return this.fwd(`/api/v1/users/${req.user.id}/avatar-options`);
  }

  // ── Profil développeur ────────────────────────────────────────────────────

  @Get('developer/:userId')
  @ApiOperation({ summary: "Profil public d'un développeur" })
  @ApiParam({ name: 'userId' })
  async getDeveloperProfile(@Param('userId') userId: string) {
    return this.fwd(`/api/v1/developer-profiles/${userId}`);
  }

  @Patch('developer/me')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Mettre à jour son profil développeur' })
  async updateDeveloperProfile(
    @Req() req: AuthRequest,
    @Body() data: UpdateDeveloperProfileDto,
  ) {
    const dto = this.parse(UpdateDeveloperProfileSchema, data);
    return this.fwd(`/api/v1/developer-profiles/${req.user.id}`, 'PATCH', {
      requesterId: req.user.id,
      data: dto,
    });
  }

  @Post('developer/me/github-sync')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Synchroniser les repos GitHub' })
  async syncGitHub(@Req() req: AuthRequest) {
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/github-sync`,
      'POST',
    );
  }

  // ── Technologies ──────────────────────────────────────────────────────────

  @Get('developer/me/technologies')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Lister mes technologies' })
  async getMyTechnologies(@Req() req: AuthRequest) {
    return this.fwd(`/api/v1/developer-profiles/${req.user.id}/technologies`);
  }

  @Post('developer/me/technologies')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Ajouter une technologie' })
  async addTechnology(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parse(TechnologySchema, body);
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/technologies`,
      'POST',
      {
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
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/technologies/${techId}`,
      'PATCH',
      {
        requesterId: req.user.id,
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
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/technologies/${techId}`,
      'DELETE',
      {
        requesterId: req.user.id,
      },
    );
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  @Get('skills/catalog')
  @ApiOperation({ summary: 'Catalogue de compétences disponibles' })
  listSkillsCatalog() {
    return this.fwd('/api/v1/developer-profiles/skills/catalog');
  }

  @Get('developer/me/skills')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Lister mes compétences' })
  async getMySkills(@Req() req: AuthRequest) {
    return this.fwd(`/api/v1/developer-profiles/${req.user.id}/skills`);
  }

  @Post('developer/me/skills')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Ajouter une compétence' })
  async addSkill(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parse(SkillSchema, body);
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/skills`,
      'POST',
      {
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
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/skills/${skillId}`,
      'PATCH',
      {
        requesterId: req.user.id,
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
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/skills/${skillId}`,
      'DELETE',
      {
        requesterId: req.user.id,
      },
    );
  }

  // ── Projets ───────────────────────────────────────────────────────────────

  @Get('developer/me/projects')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Lister mes projets' })
  async getMyProjects(@Req() req: AuthRequest) {
    return this.fwd(`/api/v1/developer-profiles/${req.user.id}/projects`);
  }

  @Post('developer/me/projects')
  @Roles(Role.DEVELOPER)
  @ApiOperation({ summary: 'Créer un projet manuellement' })
  async createProject(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parse(ProjectSchema, body);
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/projects`,
      'POST',
      {
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
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/projects/reorder`,
      'POST',
      {
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
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/projects/${projectId}`,
      'PATCH',
      {
        requesterId: req.user.id,
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
    return this.fwd(
      `/api/v1/developer-profiles/${req.user.id}/projects/${projectId}`,
      'DELETE',
      {
        requesterId: req.user.id,
      },
    );
  }
}
