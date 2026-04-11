import { Test, TestingModule } from '@nestjs/testing';
import { SkeletonCronController } from './skeleton-cron.controller';
import { SkeletonCronService } from './skeleton-cron.service';

describe('SkeletonCronController', () => {
  let skeletonCronController: SkeletonCronController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SkeletonCronController],
      providers: [SkeletonCronService],
    }).compile();

    skeletonCronController = app.get<SkeletonCronController>(SkeletonCronController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(skeletonCronController.getHello()).toBe('Hello World!');
    });
  });
});
