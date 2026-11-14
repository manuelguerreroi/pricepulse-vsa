import { Controller, Post, Body, Headers, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import { RecordPriceSnapshotHandler, ProductNotFoundError, InvalidPriceError } from './record-price-snapshot.handler';
import { RecordPriceSnapshotDto, RecordPriceSnapshotResponseDto } from './record-price-snapshot.dto';

@ApiTags('Ingestion')
@Controller('api/ingestion/snapshots')
export class RecordPriceSnapshotEndpoint {
  constructor(private readonly handler: RecordPriceSnapshotHandler) {}

  @Post()
  @ApiOperation({ summary: 'Record a new price snapshot and emit price drop event if applicable' })
  @ApiHeader({ name: 'x-trace-id', required: false, description: 'Correlation / Trace ID' })
  @ApiBody({
    type: RecordPriceSnapshotDto,
    description: 'New scraped price snapshot payload',
    examples: {
      priceDrop: {
        summary: 'Simulated 25% price drop ($75.000 CLP)',
        value: {
          productId: '17f9bc8d-5c8a-4824-ac65-fec1f0c1cf1e',
          newPriceMinorUnits: 75000,
        },
      },
      priceIncrease: {
        summary: 'Simulated price increase ($120.000 CLP)',
        value: {
          productId: '17f9bc8d-5c8a-4824-ac65-fec1f0c1cf1e',
          newPriceMinorUnits: 120000,
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: RecordPriceSnapshotResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or invalid price' })
  @ApiResponse({ status: 404, description: 'Tracked product not found' })
  async handle(
    @Body() dto: RecordPriceSnapshotDto,
    @Headers('x-trace-id') traceId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RecordPriceSnapshotResponseDto | Record<string, unknown>> {
    const result = await this.handler.execute(dto, traceId);

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

    if (error instanceof InvalidPriceError) {
      res.status(HttpStatus.BAD_REQUEST);
      return {
        type: 'https://pricepulse.dev/errors/invalid-price',
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
