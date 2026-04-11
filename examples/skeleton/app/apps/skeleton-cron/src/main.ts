import { NestFactory } from '@nestjs/core';
import { SkeletonCronModule } from './skeleton-cron.module';

async function bootstrap() {
  const app = await NestFactory.create(SkeletonCronModule);
  await app.listen(3000);
}

void bootstrap();
