import { Controller, Logger } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import {
  MatchingService,
  type SearchDevelopersFilters,
} from "./matching.service";

@Controller()
export class MatchingController {
  private readonly logger = new Logger(MatchingController.name);

  constructor(private readonly service: MatchingService) {}

  @MessagePattern({ cmd: "matching.searchDevelopers" })
  async searchDevelopers(@Payload() payload: SearchDevelopersFilters) {
    try {
      return await this.service.searchDevelopers(payload);
    } catch (err) {
      this.logger.error(
        `searchDevelopers a échoué (payload=${JSON.stringify(payload)}) : ${err instanceof Error ? err.stack : String(err)}`,
      );
      throw err;
    }
  }
}
