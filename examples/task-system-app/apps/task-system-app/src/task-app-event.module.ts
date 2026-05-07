import { Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventModule } from '@nestjs-yalc/event-manager';
import { EventEmitter2 as RawEventEmitter2 } from 'eventemitter2';

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
  providers: [
    {
      provide: RawEventEmitter2,
      useValue: new RawEventEmitter2(),
    },
  ],
  exports: [EventModule, RawEventEmitter2],
})
export class TaskAppEventModule {}
