import { Inject, Injectable } from '@nestjs/common';
import {
  HttpAbstractStrategy,
  IHttpCallStrategyResponse,
} from '@nestjs-yalc/api-strategy';

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
}
