import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import {
  MatchingService,
  type SearchDevelopersFilters,
} from "./matching.service";

@Controller()
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  @MessagePattern({ cmd: "matching.searchDevelopers" })
  searchDevelopers(@Payload() payload: SearchDevelopersFilters) {
    return this.service.searchDevelopers(payload);
  }
}
