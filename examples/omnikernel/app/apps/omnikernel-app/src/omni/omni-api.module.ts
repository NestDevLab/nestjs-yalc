import { Module } from '@nestjs/common';
import { OmniKernelModule } from '@nestjs-yalc/omnikernel-module';
import { omniApiControllers, omniApiProviders } from './omni-api.resources';

@Module({
  imports: [OmniKernelModule.register('default')],
  controllers: omniApiControllers,
  providers: omniApiProviders,
})
export class OmniApiModule {}
