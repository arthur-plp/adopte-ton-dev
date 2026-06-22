import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateDeveloperProfileDto,
  UpdateDeveloperProfileDto,
} from '@repo/contracts';
import { Events } from '@repo/contracts/events';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

type TechnologyDto = { name: string; level: SkillLevel };
type ProjectCreateDto = {
  title: string;
  description: string;
  repoUrl?: string;
  liveUrl?: string;
  technologies: string[];
};
type ProjectUpdateDto = Partial<ProjectCreateDto & { visible: boolean }>;

@Injectable()
export class DeveloperProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async requireProfile(userId: string) {
    const profile = await this.prisma.developerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profil développeur introuvable');
    return profile;
  }

  private async requireOwner(userId: string, requesterId: string) {
    const profile = await this.requireProfile(userId);
    if (profile.userId !== requesterId) throw new ForbiddenException();
    return profile;
  }

  private emitProfileUpdated(userId: string, changes: object) {
    return this.prisma.outboxEvent.create({
      data: {
        type: Events.DEVELOPER_PROFILE_UPDATED,
        payload: { userId, changes },
      },
    });
  }

  // ── Profil ───────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateDeveloperProfileDto) {
    return this.prisma.developerProfile.create({ data: { userId, ...dto } });
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.developerProfile.findUnique({
      where: { userId },
      include: {
        skills: { include: { skill: true } },
        technologies: { orderBy: { name: 'asc' } },
        projects: {
          orderBy: [{ displayOrder: 'asc' }, { githubPushedAt: 'desc' }],
        },
      },
    });
    if (!profile) throw new NotFoundException('Profil développeur introuvable');
    return profile;
  }

  async update(
    userId: string,
    requesterId: string,
    dto: UpdateDeveloperProfileDto,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const [updated] = await this.prisma.$transaction([
      this.prisma.developerProfile.update({ where: { userId }, data: dto }),
      this.emitProfileUpdated(userId, dto),
    ]);

    return updated;
    void profile;
  }

  // ── Technologies ─────────────────────────────────────────────────────────

  async getTechnologies(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.prisma.developerTechnology.findMany({
      where: { profileId: profile.id },
      orderBy: { name: 'asc' },
    });
  }

  async addTechnology(userId: string, requesterId: string, dto: TechnologyDto) {
    const profile = await this.requireOwner(userId, requesterId);

    const exists = await this.prisma.developerTechnology.findFirst({
      where: {
        profileId: profile.id,
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });
    if (exists)
      throw new ConflictException(`Technologie "${dto.name}" déjà ajoutée`);

    const [tech] = await this.prisma.$transaction([
      this.prisma.developerTechnology.create({
        data: { profileId: profile.id, ...dto },
      }),
      this.emitProfileUpdated(userId, { addedTechnology: dto.name }),
    ]);
    return { id: tech.id, name: tech.name, level: tech.level };
  }

  async updateTechnology(
    userId: string,
    requesterId: string,
    techId: string,
    level: SkillLevel,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const tech = await this.prisma.developerTechnology.findUnique({
      where: { id: techId },
    });
    if (!tech || tech.profileId !== profile.id)
      throw new NotFoundException('Technologie introuvable');

    const [updated] = await this.prisma.$transaction([
      this.prisma.developerTechnology.update({
        where: { id: techId },
        data: { level },
      }),
      this.emitProfileUpdated(userId, { updatedTechnology: tech.name, level }),
    ]);
    return updated;
  }

  async deleteTechnology(userId: string, requesterId: string, techId: string) {
    const profile = await this.requireOwner(userId, requesterId);

    const tech = await this.prisma.developerTechnology.findUnique({
      where: { id: techId },
    });
    if (!tech || tech.profileId !== profile.id)
      throw new NotFoundException('Technologie introuvable');

    await this.prisma.$transaction([
      this.prisma.developerTechnology.delete({ where: { id: techId } }),
      this.emitProfileUpdated(userId, { removedTechnology: tech.name }),
    ]);
    return { deleted: true };
  }

  // ── Skills (catalog) ─────────────────────────────────────────────────────

  async getSkills(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.prisma.developerSkill.findMany({
      where: { profileId: profile.id },
      include: { skill: true },
      orderBy: { skill: { name: 'asc' } },
    });
  }

  async listAvailableSkills() {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  async addSkill(
    userId: string,
    requesterId: string,
    payload: {
      skillId?: string;
      name?: string;
      category?: string;
      level: SkillLevel;
    },
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    let skill: { id: string; name: string };

    if (payload.skillId) {
      const found = await this.prisma.skill.findUnique({
        where: { id: payload.skillId },
      });
      if (!found) throw new NotFoundException('Compétence introuvable');
      skill = found;
    } else if (payload.name) {
      skill = await this.prisma.skill.upsert({
        where: { name: payload.name },
        create: {
          name: payload.name,
          category: payload.category ?? 'technique',
        },
        update: {},
      });
    } else {
      throw new BadRequestException('skillId ou name requis');
    }

    const exists = await this.prisma.developerSkill.findFirst({
      where: { profileId: profile.id, skillId: skill.id },
    });
    if (exists) throw new ConflictException('Compétence déjà ajoutée');

    const [entry] = await this.prisma.$transaction([
      this.prisma.developerSkill.create({
        data: {
          profileId: profile.id,
          skillId: skill.id,
          level: payload.level,
        },
        include: { skill: true },
      }),
      this.emitProfileUpdated(userId, { addedSkill: skill.name }),
    ]);
    return entry;
  }

  async updateSkill(
    userId: string,
    requesterId: string,
    skillId: string,
    level: SkillLevel,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const entry = await this.prisma.developerSkill.findFirst({
      where: { profileId: profile.id, skillId },
    });
    if (!entry)
      throw new NotFoundException('Compétence non trouvée dans le profil');

    const [updated] = await this.prisma.$transaction([
      this.prisma.developerSkill.update({
        where: { id: entry.id },
        data: { level },
        include: { skill: true },
      }),
      this.emitProfileUpdated(userId, { updatedSkill: skillId, level }),
    ]);
    return updated;
  }

  async removeSkill(userId: string, requesterId: string, skillId: string) {
    const profile = await this.requireOwner(userId, requesterId);

    const entry = await this.prisma.developerSkill.findFirst({
      where: { profileId: profile.id, skillId },
    });
    if (!entry)
      throw new NotFoundException('Compétence non trouvée dans le profil');

    await this.prisma.$transaction([
      this.prisma.developerSkill.delete({ where: { id: entry.id } }),
      this.emitProfileUpdated(userId, { removedSkill: skillId }),
    ]);
    return { deleted: true };
  }

  // ── Projets ───────────────────────────────────────────────────────────────

  async getProjects(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.prisma.project.findMany({
      where: { profileId: profile.id },
      orderBy: [
        { displayOrder: 'asc' },
        { githubPushedAt: 'desc' },
        { githubStars: 'desc' },
      ],
    });
  }

  async createProject(
    userId: string,
    requesterId: string,
    dto: ProjectCreateDto,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    return this.prisma.project.create({
      data: { profileId: profile.id, ...dto },
    });
  }

  async updateProject(
    userId: string,
    requesterId: string,
    projectId: string,
    dto: ProjectUpdateDto,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.profileId !== profile.id)
      throw new NotFoundException('Projet introuvable');

    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async reorderProjects(
    userId: string,
    requesterId: string,
    order: { id: string; displayOrder: number }[],
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    await this.prisma.$transaction(
      order.map(({ id, displayOrder }) =>
        this.prisma.project.updateMany({
          where: { id, profileId: profile.id },
          data: { displayOrder },
        }),
      ),
    );
    return { updated: order.length };
  }

  async deleteProject(userId: string, requesterId: string, projectId: string) {
    const profile = await this.requireOwner(userId, requesterId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.profileId !== profile.id)
      throw new NotFoundException('Projet introuvable');

    await this.prisma.project.delete({ where: { id: projectId } });
    return { deleted: true };
  }
}
