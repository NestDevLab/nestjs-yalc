import { Injectable } from '@nestjs/common';

@Injectable()
export class SkeletonCronService {
  getHello(): string {
    return 'Hello World!';
  }
}
