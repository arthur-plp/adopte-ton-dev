import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  DeveloperProfilesService,
  type SkillLevel,
} from './developer-profiles.service';
import { GitHubSyncService } from './github-sync.service';
import {
  CreateDeveloperProfileSchema,
  UpdateDeveloperProfileSchema,
  type CreateDeveloperProfileDto,
  type UpdateDeveloperProfileDto,
} from '@repo/contracts';

type CreateBody = {
  userId: string;
  requesterId: string;
  data: CreateDeveloperProfileDto;
};
type UpdateBody = { requesterId: string; data: UpdateDeveloperProfileDto };

@ApiTags('developer-profiles')
@Controller('developer-profiles')
export class DeveloperProfilesController {
  constructor(
    private readonly service: DeveloperProfilesService,
    private readonly githubSync: GitHubSyncService,
  ) {}

  // ── Profil ───────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Créer un profil développeur' })
  create(@Body() body: CreateBody) {
    const dto = CreateDeveloperProfileSchema.parse(body.data);
    return this.service.create(body.userId, dto);
  }

  @Get(':userId')
  @ApiOperation({
    summary: 'Profil développeur complet (skills, technologies, projets)',
  })
  @ApiParam({ name: 'userId' })
  findOne(@Param('userId') userId: string) {
    return this.service.findByUserId(userId);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Mettre à jour le profil développeur' })
  @ApiParam({ name: 'userId' })
  update(@Param('userId') userId: string, @Body() body: UpdateBody) {
    const dto = UpdateDeveloperProfileSchema.parse(body.data);
    return this.service.update(userId, body.requesterId, dto);
  }

  // ── Technologies ─────────────────────────────────────────────────────────

  @Get(':userId/technologies')
  @ApiOperation({ summary: 'Lister les technologies du profil' })
  @ApiParam({ name: 'userId' })
  getTechnologies(@Param('userId') userId: string) {
    return this.service.getTechnologies(userId);
  }

  @Post(':userId/technologies')
  @ApiOperation({ summary: 'Ajouter une technologie' })
  @ApiParam({ name: 'userId' })
  addTechnology(
    @Param('userId') userId: string,
    @Body() body: { requesterId: string; name: string; level: SkillLevel },
  ) {
    return this.service.addTechnology(userId, body.requesterId, {
      name: body.name,
      level: body.level,
    });
  }

  @Patch(':userId/technologies/:techId')
  @ApiOperation({ summary: "Modifier le niveau d'une technologie" })
  @ApiParam({ name: 'userId' })
  @ApiParam({ name: 'techId' })
  updateTechnology(
    @Param('userId') userId: string,
    @Param('techId') techId: string,
    @Body() body: { requesterId: string; level: SkillLevel },
  ) {
    return this.service.updateTechnology(
      userId,
      body.requesterId,
      techId,
      body.level,
    );
  }

  @Delete(':userId/technologies/:techId')
  @ApiOperation({ summary: 'Supprimer une technologie' })
  @ApiParam({ name: 'userId' })
  @ApiParam({ name: 'techId' })
  deleteTechnology(
    @Param('userId') userId: string,
    @Param('techId') techId: string,
    @Body() body: { requesterId: string },
  ) {
    return this.service.deleteTechnology(userId, body.requesterId, techId);
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  @Get('skills/catalog')
  @ApiOperation({
    summary: 'Lister toutes les compétences disponibles dans le catalogue',
  })
  @ApiResponse({ status: 200, description: 'Liste des Skill' })
  listSkills() {
    return this.service.listAvailableSkills();
  }

  @Get(':userId/skills')
  @ApiOperation({ summary: 'Lister les compétences du profil' })
  @ApiParam({ name: 'userId' })
  getSkills(@Param('userId') userId: string) {
    return this.service.getSkills(userId);
  }

  @Post(':userId/skills')
  @ApiOperation({ summary: 'Ajouter une compétence au profil' })
  @ApiParam({ name: 'userId' })
  addSkill(
    @Param('userId') userId: string,
    @Body() body: { requesterId: string; skillId?: string; name?: string; category?: string; level: SkillLevel },
  ) {
    return this.service.addSkill(userId, body.requesterId, {
      skillId: body.skillId,
      name: body.name,
      category: body.category,
      level: body.level,
    });
  }

  @Patch(':userId/skills/:skillId')
  @ApiOperation({ summary: "Modifier le niveau d'une compétence" })
  @ApiParam({ name: 'userId' })
  @ApiParam({ name: 'skillId' })
  updateSkill(
    @Param('userId') userId: string,
    @Param('skillId') skillId: string,
    @Body() body: { requesterId: string; level: SkillLevel },
  ) {
    return this.service.updateSkill(
      userId,
      body.requesterId,
      skillId,
      body.level,
    );
  }

  @Delete(':userId/skills/:skillId')
  @ApiOperation({ summary: 'Retirer une compétence du profil' })
  @ApiParam({ name: 'userId' })
  @ApiParam({ name: 'skillId' })
  removeSkill(
    @Param('userId') userId: string,
    @Param('skillId') skillId: string,
    @Body() body: { requesterId: string },
  ) {
    return this.service.removeSkill(userId, body.requesterId, skillId);
  }

  // ── Projets ───────────────────────────────────────────────────────────────

  @Post(':userId/github-sync')
  @ApiOperation({ summary: 'Importer les repos GitHub publics' })
  @ApiParam({ name: 'userId' })
  syncGitHub(@Param('userId') userId: string) {
    return this.githubSync.syncForUser(userId);
  }

  @Get(':userId/projects')
  @ApiOperation({ summary: 'Lister tous les projets' })
  @ApiParam({ name: 'userId' })
  getProjects(@Param('userId') userId: string) {
    return this.service.getProjects(userId);
  }

  @Post(':userId/projects')
  @ApiOperation({ summary: 'Créer un projet manuellement' })
  @ApiParam({ name: 'userId' })
  createProject(
    @Param('userId') userId: string,
    @Body()
    body: {
      requesterId: string;
      title: string;
      description: string;
      repoUrl?: string;
      liveUrl?: string;
      technologies: string[];
    },
  ) {
    return this.service.createProject(userId, body.requesterId, {
      title: body.title,
      description: body.description,
      repoUrl: body.repoUrl,
      liveUrl: body.liveUrl,
      technologies: body.technologies ?? [],
    });
  }

  @Post(':userId/projects/reorder')
  @ApiOperation({ summary: "Mettre à jour l'ordre des projets" })
  @ApiParam({ name: 'userId' })
  reorderProjects(
    @Param('userId') userId: string,
    @Body()
    body: {
      requesterId: string;
      order: { id: string; displayOrder: number }[];
    },
  ) {
    return this.service.reorderProjects(userId, body.requesterId, body.order);
  }

  @Patch(':userId/projects/:projectId')
  @ApiOperation({
    summary: 'Modifier un projet (visibilité, titre, description…)',
  })
  @ApiParam({ name: 'userId' })
  @ApiParam({ name: 'projectId' })
  updateProject(
    @Param('userId') userId: string,
    @Param('projectId') projectId: string,
    @Body()
    body: {
      requesterId: string;
      title?: string;
      description?: string;
      repoUrl?: string;
      liveUrl?: string;
      technologies?: string[];
      visible?: boolean;
    },
  ) {
    const { requesterId, ...dto } = body;
    return this.service.updateProject(userId, requesterId, projectId, dto);
  }

  @Delete(':userId/projects/:projectId')
  @ApiOperation({ summary: 'Supprimer un projet' })
  @ApiParam({ name: 'userId' })
  @ApiParam({ name: 'projectId' })
  deleteProject(
    @Param('userId') userId: string,
    @Param('projectId') projectId: string,
    @Body() body: { requesterId: string },
  ) {
    return this.service.deleteProject(userId, body.requesterId, projectId);
  }
}
