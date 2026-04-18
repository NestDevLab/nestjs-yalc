import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { IEventPayload } from '@nestjs-yalc/event-manager/event.js';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { OBSERVABILITY_OPTIONS } from '../tokens.js';
import type { NormalizedObservabilityOptions } from '../observability-options.js';
import { TelemetryService } from '../telemetry.service.js';

@Injectable()
export class OpenTelemetryEventManagerPlugin
  implements OnModuleInit, OnModuleDestroy
{
  private readonly listener = (event: string | string[], payload?: unknown) => {
    this.handleEvent(event, payload);
  };

  constructor(
    private readonly events: YalcEventService,
    private readonly telemetry: TelemetryService,
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly options: NormalizedObservabilityOptions,
  ) {}

  onModuleInit() {
    if (!this.options.enabled || !this.options.eventManager.enabled) {
      return;
    }

    this.events.emitter.onAny(this.listener);
  }

  onModuleDestroy() {
    this.events.emitter.offAny(this.listener);
  }

  private handleEvent(event: string | string[], payload?: unknown) {
    const eventName = Array.isArray(event) ? event.join('.') : event;

    if (!this.shouldRecord(eventName)) {
      return;
    }

    this.telemetry.recordYalcEvent(eventName, payload as IEventPayload);
  }

  private shouldRecord(eventName: string) {
    return (
      this.matchesAny(eventName, this.options.eventManager.listenTo) &&
      !this.matchesAny(eventName, this.options.eventManager.ignore)
    );
  }

  private matchesAny(eventName: string, patterns: string[]) {
    return patterns.some((pattern) => matchesEventPattern(eventName, pattern));
  }
}

export function matchesEventPattern(eventName: string, pattern: string) {
  if (pattern === '**') {
    return true;
  }

  const source = pattern
    .split('.')
    .map((part) => {
      if (part === '**') return '.*';
      if (part === '*') return '[^.]+';
      return escapeRegExp(part);
    })
    .join('\\.');

  return new RegExp(`^${source}$`).test(eventName);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
