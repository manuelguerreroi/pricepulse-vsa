import { Module } from '@nestjs/common';
import { RecordPriceSnapshotEndpoint } from './record-price-snapshot.endpoint';
import { RecordPriceSnapshotHandler } from './record-price-snapshot.handler';

@Module({
  controllers: [RecordPriceSnapshotEndpoint],
  providers: [RecordPriceSnapshotHandler],
  exports: [RecordPriceSnapshotHandler],
})
export class RecordPriceSnapshotModule {}
