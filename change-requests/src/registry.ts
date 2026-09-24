import { Inject, Injectable } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import type { ChangeRequestAdapter } from './types.js';

export const CHANGE_REQUEST_ADAPTERS = Symbol('change-request-adapters');

@Injectable()
export class ChangeRequestAdapterRegistry {
  private readonly adapters = new Map<string, ChangeRequestAdapter>();

  constructor(
    @Inject(CHANGE_REQUEST_ADAPTERS) adapters: ChangeRequestAdapter[],
    @Inject(YalcEventService) private readonly events: YalcEventService,
  ) {
    adapters.forEach((adapter) => this.register(adapter));
  }

  register(adapter: ChangeRequestAdapter): void {
    this.adapters.set(this.key(adapter.entityType, adapter.target), adapter);
  }

  get(entityType: string, target: string): ChangeRequestAdapter {
    const adapter = this.adapters.get(this.key(entityType, target));
    if (!adapter) {
      throw this.events.errorBadRequest('change-request.unknown-target', {
        response: { message: 'Unknown change request target' },
      });
    }
    return adapter;
  }

  private key(entityType: string, target: string): string {
    return JSON.stringify([entityType, target]);
  }
}
