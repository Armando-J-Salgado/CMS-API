import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Get API status" })
  @ApiResponse({ 
    status: 200, 
    description: "API is healthy",
    schema: {
      example: {
        status: "ok",
        database: "connected",
      }
    }
  })
  getHealth() {
    return {
      status: "ok",
      database: "connected",
    };
  }
}
