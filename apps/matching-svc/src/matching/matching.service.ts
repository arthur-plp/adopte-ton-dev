import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import { RedisService } from "../redis/redis.service";
import { computeMatchScore, type SkillLevel } from "./matching.score";

const CACHE_TTL_SECONDS = 60;

export type SearchDevelopersFilters = {
  technologies?: string[];
  levels?: Record<string, SkillLevel>;
  remoteOk?: boolean;
  location?: string;
  jobOfferId?: string;
  page: number;
  pageSize: number;
};

type DeveloperProfileResult = {
  id: string;
  userId: string;
  technologies: { name: string; level: SkillLevel }[];
  [key: string]: unknown;
};

type DeveloperSearchResponse = {
  data: DeveloperProfileResult[];
  total: number;
  page: number;
  pageSize: number;
};

type JobOfferResult = {
  requiredTechnologies: string[];
  requiredTechLevels?: Record<string, SkillLevel> | null;
};

@Injectable()
export class MatchingService {
  constructor(
    @Inject("AUTH_SVC") private readonly authClient: ClientProxy,
    @Inject("JOBS_SVC") private readonly jobsClient: ClientProxy,
    private readonly redis: RedisService,
  ) {}

  async searchDevelopers(filters: SearchDevelopersFilters) {
    let technologies = filters.technologies ?? [];
    let levels = filters.levels;

    if (filters.jobOfferId && technologies.length === 0) {
      const offer = await lastValueFrom(
        this.jobsClient.send<JobOfferResult>(
          { cmd: "job.findOne" },
          { id: filters.jobOfferId, publicOnly: true },
        ),
      );
      technologies = offer.requiredTechnologies;
      levels = offer.requiredTechLevels ?? undefined;
    }

    const cacheKey = this.buildCacheKey({ ...filters, technologies, levels });
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await lastValueFrom(
      this.authClient.send<DeveloperSearchResponse>(
        { cmd: "developer.search" },
        {
          technologies: technologies.length ? technologies : undefined,
          remoteOk: filters.remoteOk,
          location: filters.location,
          page: filters.page,
          pageSize: filters.pageSize,
        },
      ),
    );

    const scoredData = result.data
      .map((profile) => ({
        ...profile,
        score: computeMatchScore(profile.technologies, technologies, levels),
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const response = {
      data: scoredData,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
    await this.redis.set(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
    return response;
  }

  private buildCacheKey(params: {
    technologies: string[];
    levels?: Record<string, SkillLevel>;
    remoteOk?: boolean;
    location?: string;
    page: number;
    pageSize: number;
  }): string {
    const normalized = {
      technologies: [...params.technologies].sort(),
      levels: params.levels ?? null,
      remoteOk: params.remoteOk ?? null,
      location: params.location?.toLowerCase() ?? null,
      page: params.page,
      pageSize: params.pageSize,
    };
    return `matching:developers:${JSON.stringify(normalized)}`;
  }
}
