import { Inject, Injectable, Logger } from "@nestjs/common";
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
  latitude?: number;
  longitude?: number;
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
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @Inject("AUTH_SVC") private readonly authClient: ClientProxy,
    @Inject("JOBS_SVC") private readonly jobsClient: ClientProxy,
    private readonly redis: RedisService,
  ) {}

  async searchDevelopers(filters: SearchDevelopersFilters) {
    let technologies = filters.technologies ?? [];
    let levels = filters.levels;

    if (filters.jobOfferId && technologies.length === 0) {
      let offer: JobOfferResult;
      try {
        offer = await lastValueFrom(
          this.jobsClient.send<JobOfferResult>(
            { cmd: "job.findOne" },
            { id: filters.jobOfferId, publicOnly: true },
          ),
        );
      } catch (err) {
        this.logger.error(
          `Appel JOBS_SVC (job.findOne) échoué : ${String(err)}`,
        );
        throw err;
      }
      technologies = offer.requiredTechnologies;
      levels = offer.requiredTechLevels ?? undefined;
    }

    const cacheKey = this.buildCacheKey({ ...filters, technologies, levels });

    // Le cache Redis est un confort de performance, pas une dépendance dure :
    // une panne Redis ne doit jamais empêcher la recherche de fonctionner
    // (même fail-open que le rate-limiting de la Gateway).
    let cached: string | null = null;
    try {
      cached = await this.redis.get(cacheKey);
    } catch (err) {
      this.logger.warn(`Lecture cache Redis échouée, ignorée : ${String(err)}`);
    }
    if (cached) return JSON.parse(cached);

    let result: DeveloperSearchResponse;
    try {
      result = await lastValueFrom(
        this.authClient.send<DeveloperSearchResponse>(
          { cmd: "developer.search" },
          {
            technologies: technologies.length ? technologies : undefined,
            remoteOk: filters.remoteOk,
            location: filters.location,
            latitude: filters.latitude,
            longitude: filters.longitude,
            page: filters.page,
            pageSize: filters.pageSize,
          },
        ),
      );
    } catch (err) {
      this.logger.error(
        `Appel AUTH_SVC (developer.search) échoué : ${String(err)}`,
      );
      throw err;
    }

    const scoredData = result.data
      .map((profile) => ({
        ...profile,
        score: computeMatchScore(
          profile.technologies ?? [],
          technologies,
          levels,
        ),
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const response = {
      data: scoredData,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(response),
        CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Écriture cache Redis échouée, ignorée : ${String(err)}`,
      );
    }
    return response;
  }

  private buildCacheKey(params: {
    technologies: string[];
    levels?: Record<string, SkillLevel>;
    remoteOk?: boolean;
    location?: string;
    latitude?: number;
    longitude?: number;
    page: number;
    pageSize: number;
  }): string {
    const normalized = {
      technologies: [...params.technologies].sort(),
      levels: params.levels ?? null,
      remoteOk: params.remoteOk ?? null,
      location: params.location?.toLowerCase() ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      page: params.page,
      pageSize: params.pageSize,
    };
    return `matching:developers:${JSON.stringify(normalized)}`;
  }
}
