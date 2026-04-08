import { Module } from '@nestjs/common';
import {
  OmniCollectionController,
  OmniDocumentController,
  OmniExternalRefController,
  OmniNamedController,
  OmniRecordController,
  OmniRelationController,
} from './omni-rest.controllers';

@Module({
  controllers: [
    OmniNamedController,
    OmniRecordController,
    OmniDocumentController,
    OmniCollectionController,
    OmniRelationController,
    OmniExternalRefController,
  ],
})
export class OmniRestModule {}
