import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GitHubSyncService } from './github-sync.service';
import { PrismaService } from '../prisma/prisma.service';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const mockPrisma = {
  developerProfile: { findUnique: jest.fn() },
  account: { findFirst: jest.fn() },
  project: { upsert: jest.fn() },
};

const baseProfile = { id: 'dev-1', userId: 'user-1' };
const githubAccount = { userId: 'user-1', providerId: 'github', accessToken: 'ghp_token123' };

// Helper: crée un fake repo avec tous les champs attendus
function makeRepo(override: object = {}) {
  return {
    name: 'mon-repo',
    description: 'Description',
    html_url: 'https://github.com/user/mon-repo',
    languages_url: 'https://api.github.com/repos/user/mon-repo/languages',
    homepage: null,
    stargazers_count: 0,
    language: 'TypeScript',
    topics: [],
    pushed_at: '2024-01-15T10:00:00Z',
    private: false,
    ...override,
  };
}

// Helper: mockFetch qui distingue repos list vs languages URL
function mockGitHubFetch(repos: object[], languagesMap: Record<string, Record<string, number>> = {}) {
  mockFetch.mockImplementation((url: string) => {
    // Appel à l'API languages d'un repo spécifique
    for (const [repoUrl, langs] of Object.entries(languagesMap)) {
      if (url === repoUrl) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(langs) });
      }
    }
    // Appel à la liste des repos ou languages URL sans mock spécifique → vide
    if (url.includes('/languages')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    // Liste des repos
    return Promise.resolve({ ok: true, json: () => Promise.resolve(repos) });
  });
}

describe('GitHubSyncService', () => {
  let service: GitHubSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubSyncService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GitHubSyncService>(GitHubSyncService);
    jest.clearAllMocks();
  });

  describe('syncForUser', () => {
    it('lance NotFoundException si le profil n\'existe pas', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(null);
      await expect(service.syncForUser('user-inconnu')).rejects.toThrow(NotFoundException);
    });

    it('retourne { synced: 0, skipped: 0 } si pas de compte GitHub', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(null);

      const result = await service.syncForUser('user-1');

      expect(result).toEqual({ synced: 0, skipped: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retourne { synced: 0, skipped: 0 } si le token est absent', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue({ ...githubAccount, accessToken: null });

      const result = await service.syncForUser('user-1');
      expect(result).toEqual({ synced: 0, skipped: 0 });
    });

    it('synchronise les repos publics avec description ou langage', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(githubAccount);
      mockPrisma.project.upsert.mockResolvedValue({});

      const repos = [
        makeRepo({ name: 'proj-1', description: 'Desc 1' }),
        makeRepo({ name: 'proj-2', description: 'Desc 2', language: 'JavaScript' }),
      ];
      mockGitHubFetch(repos);

      const result = await service.syncForUser('user-1');

      expect(result).toEqual({ synced: 2, skipped: 0 });
      expect(mockPrisma.project.upsert).toHaveBeenCalledTimes(2);
    });

    it('skipe les repos sans description ET sans langage', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(githubAccount);

      const repos = [makeRepo({ description: null, language: null })];
      mockGitHubFetch(repos);

      const result = await service.syncForUser('user-1');

      expect(result).toEqual({ synced: 0, skipped: 1 });
      expect(mockPrisma.project.upsert).not.toHaveBeenCalled();
    });

    it('ignore les repos privés', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(githubAccount);

      const repos = [makeRepo({ private: true, description: 'Secret' })];
      mockGitHubFetch(repos);

      const result = await service.syncForUser('user-1');
      expect(result).toEqual({ synced: 0, skipped: 0 });
    });

    it('utilise le token GitHub dans le header Authorization', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(githubAccount);
      mockGitHubFetch([]);

      await service.syncForUser('user-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.github.com'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer ghp_token123' }),
        }),
      );
    });

    it('retourne { synced: 0, skipped: 0 } si l\'API GitHub répond non-ok', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(githubAccount);
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve([]) });

      const result = await service.syncForUser('user-1');
      expect(result).toEqual({ synced: 0, skipped: 0 });
    });

    it('upsert avec le bon profileId, title, stars et technologies combinées', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(githubAccount);
      mockPrisma.project.upsert.mockResolvedValue({});

      const langUrl = 'https://api.github.com/repos/user/ts-api/languages';
      const repo = makeRepo({
        name: 'ts-api',
        description: 'API TypeScript',
        html_url: 'https://github.com/user/ts-api',
        languages_url: langUrl,
        stargazers_count: 10,
        language: 'TypeScript',
        topics: ['api', 'nestjs'],
      });

      mockGitHubFetch([repo], {
        [langUrl]: { TypeScript: 95000, Shell: 500 },
      });

      await service.syncForUser('user-1');

      expect(mockPrisma.project.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            profileId_repoUrl: { profileId: 'dev-1', repoUrl: 'https://github.com/user/ts-api' },
          },
          create: expect.objectContaining({
            profileId: 'dev-1',
            title: 'ts-api',
            githubStars: 10,
            // TypeScript vient des langues détectées + topics normalisés
            technologies: expect.arrayContaining(['TypeScript', 'NestJS', 'api']),
          }),
        }),
      );
    });

    it('stocke la date de dernier push (githubPushedAt)', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.account.findFirst.mockResolvedValue(githubAccount);
      mockPrisma.project.upsert.mockResolvedValue({});

      const repo = makeRepo({ pushed_at: '2024-06-01T12:00:00Z' });
      mockGitHubFetch([repo]);

      await service.syncForUser('user-1');

      expect(mockPrisma.project.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            githubPushedAt: new Date('2024-06-01T12:00:00Z'),
          }),
        }),
      );
    });
  });
});
