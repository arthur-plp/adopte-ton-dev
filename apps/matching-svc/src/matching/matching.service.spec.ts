import { Test, TestingModule } from "@nestjs/testing";
import { of } from "rxjs";
import { MatchingService } from "./matching.service";
import { RedisService } from "../redis/redis.service";

const mockAuthClient = { send: jest.fn() };
const mockJobsClient = { send: jest.fn() };
const mockRedis = { get: jest.fn(), set: jest.fn(), flushPrefix: jest.fn() };

describe("MatchingService", () => {
  let service: MatchingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: "AUTH_SVC", useValue: mockAuthClient },
        { provide: "JOBS_SVC", useValue: mockJobsClient },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
  });

  it("retourne le résultat du cache Redis sans appeler auth-service si présent", async () => {
    const cached = { data: [{ id: "dev-1" }], total: 1, page: 1, pageSize: 20 };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.searchDevelopers({
      technologies: ["React"],
      page: 1,
      pageSize: 20,
    });

    expect(result).toEqual(cached);
    expect(mockAuthClient.send).not.toHaveBeenCalled();
  });

  it("appelle auth-service, score et trie les profils si le cache est vide", async () => {
    mockAuthClient.send.mockReturnValueOnce(
      of({
        data: [
          {
            id: "dev-1",
            userId: "u1",
            technologies: [{ name: "PHP", level: "ADVANCED" }],
          },
          {
            id: "dev-2",
            userId: "u2",
            technologies: [{ name: "React", level: "ADVANCED" }],
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      }),
    );

    const result = await service.searchDevelopers({
      technologies: ["React"],
      page: 1,
      pageSize: 20,
    });

    expect(mockAuthClient.send).toHaveBeenCalledWith(
      { cmd: "developer.search" },
      expect.objectContaining({ technologies: ["React"] }),
    );
    expect(result.data[0].id).toBe("dev-2");
    expect(result.data[0].score).toBe(100);
    expect(result.data[1].score).toBe(0);
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining("matching:developers:"),
      expect.any(String),
      60,
    );
  });

  it("résout jobOfferId via jobs-svc si aucune technologie explicite n'est fournie", async () => {
    mockJobsClient.send.mockReturnValueOnce(
      of({
        requiredTechnologies: ["React"],
        requiredTechLevels: { React: "ADVANCED" },
      }),
    );
    mockAuthClient.send.mockReturnValueOnce(
      of({ data: [], total: 0, page: 1, pageSize: 20 }),
    );

    await service.searchDevelopers({
      jobOfferId: "job-1",
      page: 1,
      pageSize: 20,
    });

    expect(mockJobsClient.send).toHaveBeenCalledWith(
      { cmd: "job.findOne" },
      { id: "job-1", publicOnly: true },
    );
    expect(mockAuthClient.send).toHaveBeenCalledWith(
      { cmd: "developer.search" },
      expect.objectContaining({ technologies: ["React"] }),
    );
  });

  it("ignore jobOfferId si des technologies explicites sont déjà fournies", async () => {
    mockAuthClient.send.mockReturnValueOnce(
      of({ data: [], total: 0, page: 1, pageSize: 20 }),
    );

    await service.searchDevelopers({
      jobOfferId: "job-1",
      technologies: ["Node.js"],
      page: 1,
      pageSize: 20,
    });

    expect(mockJobsClient.send).not.toHaveBeenCalled();
  });
});
