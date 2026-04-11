import { Module } from '@nestjs/common';
import { OmniKernelModule } from '@nestjs-yalc/omnikernel-module';
import {
  OmniCollectionController,
  OmniDocumentController,
  OmniExternalRefController,
  OmniNamedController,
  OmniRecordController,
  OmniRelationController,
} from './omni-rest.controllers';

@Module({
  imports: [OmniKernelModule.register('default')],
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
