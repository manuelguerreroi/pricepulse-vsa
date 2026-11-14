import { Controller, Post, Body, Headers, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import { RegisterTrackedUrlHandler, ProductAlreadyTrackedError, ScrapingFailedError } from './register-tracked-url.handler';
import { RegisterTrackedUrlDto, TrackedProductResponseDto } from './register-tracked-url.dto';
import { InvalidUrlError } from '@shared/domain/tracked-url.vo';
import { SsrfViolationError } from '@shared/infra/security/ssrf.validator';

@ApiTags('Catalog')
@Controller('api/catalog/products')
export class RegisterTrackedUrlEndpoint {
  constructor(private readonly handler: RegisterTrackedUrlHandler) {}

  @Post()
  @ApiOperation({ summary: 'Register a new e-commerce URL for price tracking' })
  @ApiHeader({ name: 'x-trace-id', required: false, description: 'Optional correlation/trace ID' })
  @ApiBody({
    type: RegisterTrackedUrlDto,
    description: 'E-commerce URL payload to register',
    examples: {
      mercadolibre: {
        summary: 'MercadoLibre product with simulated mock price ($100.000 CLP)',
        value: {
          url: 'https://mercadolibre.cl/p/MLC12345?mock_price=100000',
        },
      },
      usdProduct: {
        summary: 'USD product with simulated mock price ($49.99 USD)',
        value: {
          url: 'https://amazon.com/dp/B08N5WRWNW?mock_price=4999&mock_currency=USD',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: TrackedProductResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid URL or Anti-SSRF violation' })
  @ApiResponse({ status: 409, description: 'Product is already tracked' })
  @ApiResponse({ status: 502, description: 'Scraping initial price failed' })
  async handle(
    @Body() dto: RegisterTrackedUrlDto,
    @Headers('x-trace-id') traceId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TrackedProductResponseDto | Record<string, unknown>> {
    const result = await this.handler.execute(dto, traceId);

    if (result.isOk()) {
      res.status(HttpStatus.CREATED);
      return result.value;
    }

    const error = result.error;

    if (error instanceof ProductAlreadyTrackedError) {
      res.status(HttpStatus.CONFLICT);
      return {
        type: 'https://pricepulse.dev/errors/product-already-tracked',
        title: 'Conflict',
        status: HttpStatus.CONFLICT,
        detail: error.message,
      };
    }

    if (error instanceof SsrfViolationError || error instanceof InvalidUrlError) {
      res.status(HttpStatus.BAD_REQUEST);
      return {
        type: 'https://pricepulse.dev/errors/invalid-url',
        title: 'Bad Request',
        status: HttpStatus.BAD_REQUEST,
        detail: error.message,
      };
    }

    if (error instanceof ScrapingFailedError) {
      res.status(HttpStatus.BAD_GATEWAY);
      return {
        type: 'https://pricepulse.dev/errors/scraping-failed',
        title: 'Bad Gateway',
        status: HttpStatus.BAD_GATEWAY,
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
