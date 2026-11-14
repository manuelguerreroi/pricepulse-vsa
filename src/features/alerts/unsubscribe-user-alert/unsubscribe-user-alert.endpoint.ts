import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UnsubscribeUserAlertHandler, AlertNotFoundError } from './unsubscribe-user-alert.handler';
import { UnsubscribeUserAlertQueryDto, UnsubscribeResponseDto } from './unsubscribe-user-alert.dto';

@ApiTags('Alerts')
@Controller('api/alerts/unsubscribe')
export class UnsubscribeUserAlertEndpoint {
  constructor(private readonly handler: UnsubscribeUserAlertHandler) {}

  @Get()
  @ApiOperation({ summary: 'One-click unsubscribe from a price alert' })
  @ApiQuery({
    name: 'alertId',
    required: true,
    type: String,
    description: 'UUID of the user alert to deactivate',
    example: '526c7061-09c5-4c1f-bae7-f4a831774cd9',
  })
  @ApiResponse({ status: 200, type: UnsubscribeResponseDto })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async handle(
    @Query() query: UnsubscribeUserAlertQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UnsubscribeResponseDto | Record<string, unknown>> {
    const result = await this.handler.execute(query.alertId);

    if (result.isOk()) {
      res.status(HttpStatus.OK);
      return result.value;
    }

    const error = result.error;

    if (error instanceof AlertNotFoundError) {
      res.status(HttpStatus.NOT_FOUND);
      return {
        type: 'https://pricepulse.dev/errors/alert-not-found',
        title: 'Not Found',
        status: HttpStatus.NOT_FOUND,
        detail: error.message,
      };
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR);
    return {
      type: 'https://pricepulse.dev/errors/internal',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: (error as Error).message,
    };
  }
}
