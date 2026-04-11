import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkeletonPhone } from '@nestjs-yalc/skeleton-module';
import { PhonesController, phonesResourceProviders } from './phones.resource';

@Module({
  imports: [TypeOrmModule.forFeature([SkeletonPhone], 'default')],
  controllers: [PhonesController],
  providers: phonesResourceProviders,
  exports: [TypeOrmModule],
})
export class PhonesModule {}
