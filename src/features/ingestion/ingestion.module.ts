import { Module } from '@nestjs/common';
import { RecordPriceSnapshotModule } from './record-price-snapshot/record-price-snapshot.module';

@Module({
  imports: [RecordPriceSnapshotModule],
  exports: [RecordPriceSnapshotModule],
})
export class IngestionModule {}
