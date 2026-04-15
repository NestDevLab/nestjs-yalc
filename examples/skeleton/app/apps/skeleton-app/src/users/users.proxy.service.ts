import { Inject, Injectable } from '@nestjs/common';
import {
  HttpAbstractStrategy,
  IHttpCallStrategyResponse,
} from '@nestjs-yalc/api-strategy/strategies/http-abstract-call.strategy.js';

export const USERS_HTTP_STRATEGY = 'USERS_HTTP_STRATEGY';

@Injectable()
export class UsersProxyService {
  constructor(
    @Inject(USERS_HTTP_STRATEGY)
    private readonly httpStrategy: HttpAbstractStrategy,
  ) {}

  async fetchUsers(): Promise<IHttpCallStrategyResponse<unknown>> {
    return this.httpStrategy.get('/users');
  }

  async fetchPhones(): Promise<IHttpCallStrategyResponse<unknown>> {
    const base = process.env.SKELETON_BASE_URL ?? '';
    const url = base ? `${base}/phones` : '/phones';
    return this.httpStrategy.get(url);
  }

  async createPhone(
    payload: Record<string, unknown>,
  ): Promise<IHttpCallStrategyResponse<unknown>> {
    const base = process.env.SKELETON_BASE_URL ?? '';
    const url = base ? `${base}/phones` : '/phones';
    return this.httpStrategy.post(url, { data: payload });
  }
}
