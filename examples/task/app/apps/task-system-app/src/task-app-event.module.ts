import { Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventModule } from '@nestjs-yalc/event-manager';

@Global()
@Module({
  imports: [
    EventModule.forRootAsync({
      eventEmitter: {
        provide: EventEmitter2,
        useValue: new EventEmitter2(),
      },
    }),
  ],
  exports: [EventModule],
})
export class TaskAppEventModule {}
