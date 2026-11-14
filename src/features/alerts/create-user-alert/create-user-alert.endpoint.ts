import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateUserAlertHandler, ProductNotFoundError, ActiveAlertAlreadyExistsError, InvalidTargetPriceError } from './create-user-alert.handler';
import { CreateUserAlertDto, UserAlertResponseDto } from './create-user-alert.dto';

@ApiTags('Alerts')
@Controller('api/alerts')
export class CreateUserAlertEndpoint {
  constructor(private readonly handler: CreateUserAlertHandler) {}

  @Post()
  @ApiOperation({ summary: 'Create a price drop alert subscription for a tracked product' })
  @ApiBody({
    type: CreateUserAlertDto,
    description: 'Alert subscription payload with user email and target price threshold',
    examples: {
      sampleAlert: {
        summary: 'Target price alert at $80.000 CLP',
        value: {
          userEmail: 'comprador@gmail.com',
          productId: '17f9bc8d-5c8a-4824-ac65-fec1f0c1cf1e',
          targetPriceMinorUnits: 80000,
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: UserAlertResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid target price or validation error' })
  @ApiResponse({ status: 404, description: 'Tracked product not found' })
  @ApiResponse({ status: 409, description: 'User already has an active alert for this product' })
  async handle(
    @Body() dto: CreateUserAlertDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserAlertResponseDto | Record<string, unknown>> {
    const result = await this.handler.execute(dto);

    if (result.isOk()) {
      res.status(HttpStatus.CREATED);
      return result.value;
    }

    const error = result.error;

    if (error instanceof ProductNotFoundError) {
      res.status(HttpStatus.NOT_FOUND);
      return {
        type: 'https://pricepulse.dev/errors/product-not-found',
        title: 'Not Found',
        status: HttpStatus.NOT_FOUND,
        detail: error.message,
      };
    }

    if (error instanceof ActiveAlertAlreadyExistsError) {
      res.status(HttpStatus.CONFLICT);
      return {
        type: 'https://pricepulse.dev/errors/active-alert-exists',
        title: 'Conflict',
        status: HttpStatus.CONFLICT,
        detail: error.message,
      };
    }

    if (error instanceof InvalidTargetPriceError) {
      res.status(HttpStatus.BAD_REQUEST);
      return {
        type: 'https://pricepulse.dev/errors/invalid-target-price',
        title: 'Bad Request',
        status: HttpStatus.BAD_REQUEST,
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
