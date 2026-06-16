/**
 * Tests d'intégration — DeveloperProfilesController (auth-service)
 * Vérifie : résolution des routes, codes HTTP, mapping exceptions → statuts.
 * Les services sont mockés ; seul le pipeline NestJS est réel.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as (
  app: unknown,
) => import('supertest').SuperTest<import('supertest').Test>;
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DeveloperProfilesController } from './developer-profiles.controller';
import { DeveloperProfilesService } from './developer-profiles.service';
import { GitHubSyncService } from './github-sync.service';

const mockService = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  getTechnologies: jest.fn(),
  addTechnology: jest.fn(),
  updateTechnology: jest.fn(),
  deleteTechnology: jest.fn(),
  getSkills: jest.fn(),
  listAvailableSkills: jest.fn(),
  addSkill: jest.fn(),
  updateSkill: jest.fn(),
  removeSkill: jest.fn(),
  getProjects: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  reorderProjects: jest.fn(),
  deleteProject: jest.fn(),
};

const mockGitHubSync = { syncForUser: jest.fn() };

describe('DeveloperProfilesController (intégration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DeveloperProfilesController],
      providers: [
        { provide: DeveloperProfilesService, useValue: mockService },
        { provide: GitHubSyncService, useValue: mockGitHubSync },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── Routes & résolution ──────────────────────────────────────────────────

  describe('GET /developer-profiles/skills/catalog (résolution de route)', () => {
    it('retourne 200 et ne confond pas avec /:userId/skills', async () => {
      mockService.listAvailableSkills.mockResolvedValue([
        { id: 's1', name: 'API REST', category: 'technique' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/developer-profiles/skills/catalog')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(mockService.listAvailableSkills).toHaveBeenCalled();
    });
  });

  // ─── Technologies ─────────────────────────────────────────────────────────

  describe('POST /developer-profiles/:userId/technologies', () => {
    it('retourne 201 sur ajout nominal', async () => {
      const tech = {
        id: 'tech-1',
        profileId: 'dev-1',
        name: 'TypeScript',
        level: 'ADVANCED',
      };
      mockService.addTechnology.mockResolvedValue(tech);

      const res = await request(app.getHttpServer())
        .post('/developer-profiles/user-1/technologies')
        .send({ requesterId: 'user-1', name: 'TypeScript', level: 'ADVANCED' })
        .expect(201);

      expect(res.body).toEqual(tech);
    });

    it('retourne 409 si la technologie est déjà ajoutée', async () => {
      mockService.addTechnology.mockRejectedValue(
        new ConflictException('Technologie "TypeScript" déjà ajoutée'),
      );

      await request(app.getHttpServer())
        .post('/developer-profiles/user-1/technologies')
        .send({
          requesterId: 'user-1',
          name: 'TypeScript',
          level: 'INTERMEDIATE',
        })
        .expect(409);
    });

    it('retourne 403 si le requesterId ne possède pas le profil', async () => {
      mockService.addTechnology.mockRejectedValue(new ForbiddenException());

      await request(app.getHttpServer())
        .post('/developer-profiles/user-1/technologies')
        .send({ requesterId: 'hacker', name: 'React', level: 'BEGINNER' })
        .expect(403);
    });
  });

  describe('DELETE /developer-profiles/:userId/technologies/:techId', () => {
    it('retourne 200 sur suppression nominale', async () => {
      mockService.deleteTechnology.mockResolvedValue({ deleted: true });

      const res = await request(app.getHttpServer())
        .delete('/developer-profiles/user-1/technologies/tech-1')
        .send({ requesterId: 'user-1' })
        .expect(200);

      expect(res.body).toEqual({ deleted: true });
    });

    it('retourne 404 si la technologie appartient à un autre profil', async () => {
      mockService.deleteTechnology.mockRejectedValue(
        new NotFoundException('Technologie introuvable'),
      );

      await request(app.getHttpServer())
        .delete('/developer-profiles/user-1/technologies/tech-autre')
        .send({ requesterId: 'user-1' })
        .expect(404);
    });
  });

  // ─── Skills ───────────────────────────────────────────────────────────────

  describe('POST /developer-profiles/:userId/skills', () => {
    it('retourne 201 sur ajout nominal', async () => {
      const entry = {
        id: 'ds-1',
        profileId: 'dev-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE',
      };
      mockService.addSkill.mockResolvedValue(entry);

      const res = await request(app.getHttpServer())
        .post('/developer-profiles/user-1/skills')
        .send({
          requesterId: 'user-1',
          skillId: 'skill-1',
          level: 'INTERMEDIATE',
        })
        .expect(201);

      expect(res.body).toEqual(entry);
    });

    it("retourne 404 si la compétence du catalogue n'existe pas", async () => {
      mockService.addSkill.mockRejectedValue(
        new NotFoundException('Compétence introuvable'),
      );

      await request(app.getHttpServer())
        .post('/developer-profiles/user-1/skills')
        .send({
          requesterId: 'user-1',
          skillId: 'skill-inconnu',
          level: 'BEGINNER',
        })
        .expect(404);
    });

    it('retourne 409 si la compétence est déjà ajoutée', async () => {
      mockService.addSkill.mockRejectedValue(
        new ConflictException('Compétence déjà ajoutée'),
      );

      await request(app.getHttpServer())
        .post('/developer-profiles/user-1/skills')
        .send({ requesterId: 'user-1', skillId: 'skill-1', level: 'ADVANCED' })
        .expect(409);
    });
  });

  // ─── Projets ──────────────────────────────────────────────────────────────

  describe('POST /developer-profiles/:userId/projects', () => {
    it('retourne 201 sur création nominale', async () => {
      const project = {
        id: 'proj-1',
        profileId: 'dev-1',
        title: 'Mon app',
        description: 'Cool',
      };
      mockService.createProject.mockResolvedValue(project);

      const res = await request(app.getHttpServer())
        .post('/developer-profiles/user-1/projects')
        .send({
          requesterId: 'user-1',
          title: 'Mon app',
          description: 'Cool',
          technologies: [],
        })
        .expect(201);

      expect(res.body).toEqual(project);
    });

    it('retourne 403 si le requesterId ne possède pas le profil', async () => {
      mockService.createProject.mockRejectedValue(new ForbiddenException());

      await request(app.getHttpServer())
        .post('/developer-profiles/user-1/projects')
        .send({
          requesterId: 'hacker',
          title: 'x',
          description: 'y',
          technologies: [],
        })
        .expect(403);
    });
  });

  describe('DELETE /developer-profiles/:userId/projects/:projectId', () => {
    it('retourne 200 sur suppression nominale', async () => {
      mockService.deleteProject.mockResolvedValue({ deleted: true });

      await request(app.getHttpServer())
        .delete('/developer-profiles/user-1/projects/proj-1')
        .send({ requesterId: 'user-1' })
        .expect(200);
    });

    it('retourne 404 si le projet appartient à un autre profil', async () => {
      mockService.deleteProject.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await request(app.getHttpServer())
        .delete('/developer-profiles/user-1/projects/proj-autre')
        .send({ requesterId: 'user-1' })
        .expect(404);
    });
  });
});
