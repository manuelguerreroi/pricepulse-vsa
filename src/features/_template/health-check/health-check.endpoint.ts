import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckHandler } from './health-check.handler';
import { LivenessResponseDto, ReadinessResponseDto } from './health-check.dto';

@ApiTags('Health')
@Controller('health')
export class HealthCheckEndpoint {
  constructor(private readonly handler: HealthCheckHandler) {}

  @Get('liveness')
  @ApiOperation({ summary: 'Process liveness check' })
  @ApiResponse({ status: 200, type: LivenessResponseDto })
  getLiveness(): LivenessResponseDto {
    return this.handler.executeLiveness();
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Infrastructure readiness check (PostgreSQL, Valkey, NATS)' })
  @ApiResponse({ status: 200, type: ReadinessResponseDto })
  @ApiResponse({ status: 503, description: 'One or more infrastructure services are unhealthy' })
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponseDto> {
    const result = await this.handler.executeReadiness();

    if (result.status === 'not_ready') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    } else {
      res.status(HttpStatus.OK);
    }

    return result;
  }
}
