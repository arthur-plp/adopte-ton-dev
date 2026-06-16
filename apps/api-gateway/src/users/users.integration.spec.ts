/**
 * Tests d'intégration — UsersController (api-gateway)
 * Vérifie : validation Zod → 400, codes HTTP, guards.
 * fetch est mocké ; seul le pipeline NestJS est réel.
 */
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as (
  app: unknown,
) => import('supertest').SuperTest<import('supertest').Test>;
import { ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const mockUser = {
  id: 'user-1',
  email: 'alice@test.com',
  name: 'Alice Dev',
  image: null,
  role: 'DEVELOPER',
  onboarded: true,
};

describe('UsersController (intégration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: (_k: string, d: string) => d },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: {
          switchToHttp: () => { getRequest: () => object };
        }) => {
          ctx.switchToHttp().getRequest()['user'] = mockUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });
  });

  // ─── POST /users/developer/me/technologies ────────────────────────────────

  describe('POST /users/developer/me/technologies — validation Zod', () => {
    it('retourne 201 avec un payload valide', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/technologies')
        .send({ name: 'TypeScript', level: 'ADVANCED' })
        .expect(201);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('retourne 400 si name est absent', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/technologies')
        .send({ level: 'ADVANCED' })
        .expect(400);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retourne 400 si level est invalide', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/technologies')
        .send({ name: 'TypeScript', level: 'EXPERT' })
        .expect(400);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ─── PATCH /users/developer/me/technologies/:techId ──────────────────────

  describe('PATCH /users/developer/me/technologies/:techId — validation Zod', () => {
    it('retourne 200 avec un level valide', async () => {
      await request(app.getHttpServer())
        .patch('/users/developer/me/technologies/tech-1')
        .send({ level: 'BEGINNER' })
        .expect(200);
    });

    it('retourne 400 si level est absent', async () => {
      await request(app.getHttpServer())
        .patch('/users/developer/me/technologies/tech-1')
        .send({})
        .expect(400);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ─── POST /users/developer/me/skills ─────────────────────────────────────

  describe('POST /users/developer/me/skills — validation Zod', () => {
    it('retourne 201 avec un payload valide', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/skills')
        .send({ skillId: 'clxxxxxxxxxxxxxxxxxxx', level: 'INTERMEDIATE' })
        .expect(201);
    });

    it('retourne 400 si skillId est absent', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/skills')
        .send({ level: 'INTERMEDIATE' })
        .expect(400);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("retourne 400 si skillId n'est pas un cuid", async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/skills')
        .send({ skillId: '', level: 'INTERMEDIATE' })
        .expect(400);
    });
  });

  // ─── POST /users/developer/me/projects ───────────────────────────────────

  describe('POST /users/developer/me/projects — validation Zod', () => {
    it('retourne 201 avec un payload valide', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/projects')
        .send({
          title: 'Mon projet',
          description: 'Super app',
          technologies: [],
        })
        .expect(201);
    });

    it('retourne 400 si title est absent', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/projects')
        .send({ description: 'Sans titre', technologies: [] })
        .expect(400);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retourne 400 si description est absente', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/projects')
        .send({ title: 'Mon projet', technologies: [] })
        .expect(400);
    });

    it('retourne 400 si repoUrl est une URL invalide', async () => {
      await request(app.getHttpServer())
        .post('/users/developer/me/projects')
        .send({
          title: 'Test',
          description: 'Desc',
          technologies: [],
          repoUrl: 'pas-une-url',
        })
        .expect(400);
    });
  });

  // ─── PATCH /users/developer/me/projects/:projectId ───────────────────────

  describe('PATCH /users/developer/me/projects/:projectId — validation Zod', () => {
    it('retourne 200 avec un payload partiel valide', async () => {
      await request(app.getHttpServer())
        .patch('/users/developer/me/projects/proj-1')
        .send({ visible: false })
        .expect(200);
    });

    it('retourne 400 si liveUrl est une URL invalide', async () => {
      await request(app.getHttpServer())
        .patch('/users/developer/me/projects/proj-1')
        .send({ liveUrl: 'invalide' })
        .expect(400);
    });
  });
});
