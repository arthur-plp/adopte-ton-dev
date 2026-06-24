import { Test, TestingModule } from "@nestjs/testing";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";

const mockService = { searchDevelopers: jest.fn() };

describe("MatchingController", () => {
  let controller: MatchingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchingController],
      providers: [{ provide: MatchingService, useValue: mockService }],
    }).compile();

    controller = module.get<MatchingController>(MatchingController);
    jest.clearAllMocks();
  });

  it("délègue searchDevelopers au service avec le payload reçu", async () => {
    const payload = { technologies: ["React"], page: 1, pageSize: 20 };
    const expected = { data: [], total: 0, page: 1, pageSize: 20 };
    mockService.searchDevelopers.mockResolvedValue(expected);

    const result = await controller.searchDevelopers(payload);

    expect(result).toEqual(expected);
    expect(mockService.searchDevelopers).toHaveBeenCalledWith(payload);
  });
});
