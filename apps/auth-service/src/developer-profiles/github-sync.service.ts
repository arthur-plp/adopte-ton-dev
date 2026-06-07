import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  language: string | null;
  languages_url: string;
  topics: string[];
  pushed_at: string;
  private: boolean;
}

export interface GitHubSyncResult {
  synced: number;
  skipped: number;
}

@Injectable()
export class GitHubSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncForUser(userId: string): Promise<GitHubSyncResult> {
    const profile = await this.prisma.developerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil développeur introuvable');

    const account = await this.prisma.account.findFirst({
      where: { userId, providerId: 'github' },
    });
    if (!account?.accessToken) {
      return { synced: 0, skipped: 0 };
    }

    const repos = await this.fetchGitHubRepos(account.accessToken);
    const publicRepos = repos.filter((r) => !r.private);

    let synced = 0;
    let skipped = 0;

    for (const repo of publicRepos) {
      if (!repo.description && !repo.language) {
        skipped++;
        continue;
      }

      const languages = await this.fetchRepoLanguages(repo.languages_url, account.accessToken);
      const technologies = this.extractTechnologies(repo, languages);
      const githubPushedAt = repo.pushed_at ? new Date(repo.pushed_at) : null;

      await this.prisma.project.upsert({
        where: {
          profileId_repoUrl: {
            profileId: profile.id,
            repoUrl: repo.html_url,
          },
        },
        create: {
          profileId: profile.id,
          title: repo.name,
          description: repo.description ?? `Projet GitHub : ${repo.name}`,
          repoUrl: repo.html_url,
          liveUrl: repo.homepage ?? undefined,
          technologies,
          githubStars: repo.stargazers_count,
          githubPushedAt,
        },
        update: {
          title: repo.name,
          description: repo.description ?? `Projet GitHub : ${repo.name}`,
          liveUrl: repo.homepage ?? undefined,
          technologies,
          githubStars: repo.stargazers_count,
          githubPushedAt,
        },
      });

      synced++;
    }

    return { synced, skipped };
  }

  private async fetchGitHubRepos(accessToken: string): Promise<GitHubRepo[]> {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=pushed', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) return [];
    return response.json() as Promise<GitHubRepo[]>;
  }

  private async fetchRepoLanguages(
    languagesUrl: string,
    accessToken: string,
  ): Promise<Record<string, number>> {
    try {
      const response = await fetch(languagesUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!response.ok) return {};
      return response.json() as Promise<Record<string, number>>;
    } catch {
      return {};
    }
  }

  private extractTechnologies(repo: GitHubRepo, languages: Record<string, number>): string[] {
    const techs = new Set<string>();

    // Toutes les langues détectées par GitHub (triées par bytes de code)
    const sortedLangs = Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .map(([lang]) => lang);
    for (const lang of sortedLangs) techs.add(lang);

    // Langue principale si absente (fallback)
    if (repo.language) techs.add(repo.language);

    // Topics ajoutés manuellement par l'auteur du repo
    for (const topic of repo.topics ?? []) {
      // Normalise les topics courants vers des noms propres
      const normalized = this.normalizeTopic(topic);
      if (normalized) techs.add(normalized);
    }

    return Array.from(techs);
  }

  private normalizeTopic(topic: string): string {
    const map: Record<string, string> = {
      'nextjs': 'Next.js', 'next-js': 'Next.js',
      'reactjs': 'React', 'react-js': 'React', 'react': 'React',
      'nodejs': 'Node.js', 'node-js': 'Node.js', 'node': 'Node.js',
      'nestjs': 'NestJS', 'nest-js': 'NestJS',
      'vuejs': 'Vue.js', 'vue-js': 'Vue.js', 'vue': 'Vue.js',
      'nuxtjs': 'Nuxt.js', 'nuxt': 'Nuxt.js',
      'typescript': 'TypeScript', 'ts': 'TypeScript',
      'javascript': 'JavaScript', 'js': 'JavaScript',
      'tailwindcss': 'TailwindCSS', 'tailwind': 'TailwindCSS',
      'postgresql': 'PostgreSQL', 'postgres': 'PostgreSQL',
      'mongodb': 'MongoDB', 'mongo': 'MongoDB',
      'graphql': 'GraphQL',
      'docker': 'Docker',
      'prisma': 'Prisma',
      'trpc': 'tRPC',
      'svelte': 'Svelte', 'sveltekit': 'SvelteKit',
      'angular': 'Angular',
      'express': 'Express',
      'fastapi': 'FastAPI',
      'django': 'Django',
      'laravel': 'Laravel',
      'spring': 'Spring',
      'rust': 'Rust',
      'go': 'Go',
      'python': 'Python',
      'java': 'Java',
      'csharp': 'C#', 'dotnet': '.NET',
    };
    return map[topic.toLowerCase()] ?? topic;
  }
}
