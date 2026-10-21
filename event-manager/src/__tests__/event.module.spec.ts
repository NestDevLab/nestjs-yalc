import { describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { ImprovedLoggerService } from '@nestjs-yalc/logger/logger-abstract.service.js';
import { AppLoggerFactory, ImprovedNestLogger } from '@nestjs-yalc/logger';
import {
  EventModule,
  EVENT_LOGGER,
  OPTION_PROVIDER,
  ILoggerProviderOptionsObject,
} from '../event.module.js';
import { YalcEventService } from '../event.service.js';
import { Logger } from '@nestjs/common';

describe('EventModule', () => {
  it('should provide YalcEventService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventModule.forRootAsync(), EventEmitterModule.forRoot()],
    }).compile();

    const eventService = moduleRef.get<YalcEventService>(YalcEventService);
    expect(eventService).toBeDefined();
  });

  it('should provide custom logger', async () => {
    const logger = new ImprovedNestLogger('test', {});
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({ loggerProvider: logger }),
        EventEmitterModule.forRoot(),
      ],
    }).compile();

    const providedLogger = moduleRef.get<ImprovedLoggerService>(EVENT_LOGGER);
    expect(providedLogger).toBeInstanceOf(ImprovedNestLogger);
  });

  it('should provide custom emitter', async () => {
    const emitter = new EventEmitter2();
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({
          eventEmitter: { provide: EventEmitter2, useValue: emitter },
        }),
        EventEmitterModule.forRoot(),
      ],
    }).compile();

    const providedEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);
    expect(providedEmitter).toBeInstanceOf(EventEmitter2);
  });

  it('should provide logger from factory if loggerProvider is an object', async () => {
    const loggerProvider: ILoggerProviderOptionsObject = {
      context: 'Test',
      loggerLevels: ['error'],
      loggerType: 'nest-logger',
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({ loggerProvider }),
        EventEmitterModule.forRoot(),
      ],
    }).compile();

    const providedLogger = moduleRef.get<ImprovedLoggerService>(EVENT_LOGGER);
    expect(providedLogger).toBeDefined();
  });

  it('should provide logger from factory if loggerProvider is a string', async () => {
    const loggerProvider = 'Test';
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({ loggerProvider }),
        EventEmitterModule.forRoot(),
      ],
    }).compile();

    const providedLogger = moduleRef.get<ImprovedLoggerService>(loggerProvider);
    expect(providedLogger).toBeDefined();
  });

  it('should initialize the EventModule with optionProvider', async () => {
    const loggerProvider = 'Test';
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync(
          { loggerProvider },
          {
            provide: OPTION_PROVIDER,
            useValue: {
              logger: new ImprovedNestLogger('test', {}),
              emitter: new EventEmitter2(),
            },
          },
        ),
        EventEmitterModule.forRoot(),
      ],
    }).compile();

    const providedLogger = moduleRef.get<ImprovedLoggerService>(loggerProvider);
    expect(providedLogger).toBeDefined();
  });

  it('should provide logger from factory if loggerProvider is a provider', async () => {
    const loggerProvider = {
      provide: 'Test',
      useFactory: () => Logger,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({ loggerProvider }),
        EventEmitterModule.forRoot(),
      ],
    }).compile();

    const providedLogger = moduleRef.get<ImprovedLoggerService>(
      loggerProvider.provide,
    );
    expect(providedLogger).toBeDefined();
  });

  it('should provide emitter from factory if eventEmitter is a provider', async () => {
    const eventEmitter = 'Test';
    const provider = {
      provide: eventEmitter,
      useValue: new EventEmitter2(),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({
          eventEmitter: { provide: 'test', useExisting: eventEmitter },
        }),
        {
          module: EventEmitterModule,
          providers: [provider],
          exports: [provider],
          global: true,
        },
      ],
    }).compile();

    const providedEmitter = moduleRef.get<EventEmitter2>(eventEmitter);
    expect(providedEmitter).toBeInstanceOf(EventEmitter2);
  });

  // Add more tests as needed to cover all branches of your code
});

describe('EventModule consumer contracts', () => {
  it('exports the same external logger and custom service instance through Nest DI', async () => {
    const logger = new ImprovedNestLogger('external', {});
    const emitter = new EventEmitter2();
    const shared = {
      module: class SharedEventsModule {},
      providers: [
        { provide: 'SHARED_LOGGER', useValue: logger },
        { provide: 'SHARED_EMITTER', useValue: emitter },
      ],
      exports: ['SHARED_LOGGER', 'SHARED_EMITTER'],
    };
    const events = EventModule.forRootAsync({
      imports: [shared],
      loggerProvider: {
        provide: 'CUSTOM_LOGGER',
        useExisting: 'SHARED_LOGGER',
      },
      eventEmitter: {
        provide: 'CUSTOM_EMITTER',
        useExisting: 'SHARED_EMITTER',
      },
      eventServiceToken: 'CUSTOM_EVENTS',
      eventService: (resolvedLogger, resolvedEmitter) =>
        new YalcEventService(resolvedLogger, resolvedEmitter),
    });
    const moduleRef = await Test.createTestingModule({
      imports: [events],
      providers: [
        {
          provide: 'CONSUMER',
          inject: ['CUSTOM_LOGGER', 'CUSTOM_EVENTS'],
          useFactory: (
            injectedLogger: ImprovedLoggerService,
            service: YalcEventService,
          ) => ({ injectedLogger, service }),
        },
      ],
    }).compile();
    const consumer = moduleRef.get('CONSUMER');
    expect(consumer.injectedLogger).toBe(logger);
    expect(consumer.service.logger).toBe(logger);
    expect(consumer.service.emitter).toBe(emitter);
    await moduleRef.close();
  });

  it.each([false, true])(
    'honors OPTION_PROVIDER emitter with imported emitter module = %s',
    async (externalModule) => {
      const emitter = new EventEmitter2();
      const logger = new ImprovedNestLogger('options', {});
      const moduleRef = await Test.createTestingModule({
        imports: [
          EventModule.forRootAsync(
            {
              imports: externalModule ? [EventEmitterModule.forRoot()] : [],
              loggerProvider: { context: 'ignored fallback' },
            },
            { provide: OPTION_PROVIDER, useValue: { logger, emitter } },
          ),
        ],
        providers: [
          {
            provide: 'CONSUMER',
            inject: [EVENT_LOGGER, YalcEventService],
            useFactory: (
              injectedLogger: ImprovedLoggerService,
              service: YalcEventService,
            ) => ({ injectedLogger, service }),
          },
        ],
      }).compile();
      const consumer = moduleRef.get('CONSUMER');
      expect(consumer.injectedLogger).toBe(logger);
      expect(consumer.service.logger).toBe(logger);
      expect(consumer.service.emitter).toBe(emitter);
      await moduleRef.close();
    },
  );

  it('gives explicit Nest providers precedence over OPTION_PROVIDER', async () => {
    const logger = new ImprovedNestLogger('explicit', {});
    const emitter = new EventEmitter2();
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync(
          {
            loggerProvider: { provide: EVENT_LOGGER, useValue: logger },
            eventEmitter: { provide: EventEmitter2, useValue: emitter },
          },
          {
            provide: OPTION_PROVIDER,
            useValue: {
              logger: new ImprovedNestLogger('ignored', {}),
              emitter: new EventEmitter2(),
            },
          },
        ),
      ],
    }).compile();
    const service = moduleRef.get(YalcEventService);
    expect(service.logger).toBe(logger);
    expect(service.emitter).toBe(emitter);
    await moduleRef.close();
  });

  it('preserves string logger tokens as local factories rather than external aliases', async () => {
    const external = new ImprovedNestLogger('external', {});
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({
          imports: [
            {
              module: class ExternalLoggerModule {},
              providers: [{ provide: 'LEGACY_LOGGER', useValue: external }],
              exports: ['LEGACY_LOGGER'],
            },
            EventEmitterModule.forRoot(),
          ],
          loggerProvider: 'LEGACY_LOGGER',
        }),
      ],
      providers: [
        {
          provide: 'CONSUMER',
          inject: ['LEGACY_LOGGER', YalcEventService],
          useFactory: (
            logger: ImprovedLoggerService,
            service: YalcEventService,
          ) => ({ logger, service }),
        },
      ],
    }).compile();
    const consumer = moduleRef.get('CONSUMER');
    expect(consumer.logger).not.toBe(external);
    expect(consumer.service.logger).toBe(consumer.logger);
    await moduleRef.close();
  });

  it('preserves class emitter providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventModule.forRootAsync({ eventEmitter: EventEmitter2 })],
    }).compile();
    const service = moduleRef.get(YalcEventService);
    expect(service.emitter).toBeInstanceOf(EventEmitter2);
    expect(service.emitter).toBe(moduleRef.get(EventEmitter2));
    await moduleRef.close();
  });

  it('fails clearly without any emitter provider', async () => {
    await expect(
      Test.createTestingModule({
        imports: [EventModule.forRootAsync()],
      }).compile(),
    ).rejects.toThrow(
      'EventModule requires an emitter: configure eventEmitter, OPTION_PROVIDER.emitter, or import EventEmitterModule.forRoot().',
    );
  });

  it('retains overrideLoggerLevels as a no-op for compatibility', async () => {
    const logger = new ImprovedNestLogger('test', {});
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRootAsync({
          loggerProvider: logger,
          overrideLoggerLevels: [],
          eventEmitter: {
            provide: EventEmitter2,
            useValue: new EventEmitter2(),
          },
        }),
      ],
    }).compile();
    expect(moduleRef.get(YalcEventService).logger).toBe(logger);
    await moduleRef.close();
  });
});
