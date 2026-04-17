import { Inject, Injectable } from '@nestjs/common';
import type { IHttpCallStrategy } from '@nestjs-yalc/api-strategy';
import type {
  SkeletonPhoneCreateInput,
  SkeletonPhoneType,
} from '../skeleton-phone.dto.js';
import type {
  SkeletonUserCreateInput,
  SkeletonUserType,
} from '../skeleton-user.dto.js';

export const USERS_CLIENT_API_STRATEGY = 'USERS_CLIENT_API_STRATEGY';
export const USERS_CLIENT_LOCAL_API_STRATEGY =
  'USERS_CLIENT_LOCAL_API_STRATEGY';
export const USERS_CLIENT_HTTP_API_STRATEGY = 'USERS_CLIENT_HTTP_API_STRATEGY';

type EmptyQuery = Record<string, never>;

export interface UsersClientPageData {
  startRow: number;
  count: number;
  [key: string]: unknown;
}

export interface UsersClientListResponse<TItem> {
  list: TItem[];
  pageData: UsersClientPageData;
}

@Injectable()
export class UsersApiClient {
  constructor(
    @Inject(USERS_CLIENT_API_STRATEGY)
    private readonly api: IHttpCallStrategy,
  ) {}

  async listUsers() {
    const res = await this.api.get<
      never,
      EmptyQuery,
      UsersClientListResponse<SkeletonUserType>
    >('/users');
    return res.data;
  }

  async createUser(payload: SkeletonUserCreateInput) {
    const res = await this.api.post<
      SkeletonUserCreateInput,
      EmptyQuery,
      SkeletonUserType
    >('/users', { data: payload });
    return res.data;
  }

  async listPhones() {
    const res = await this.api.get<
      never,
      EmptyQuery,
      UsersClientListResponse<SkeletonPhoneType>
    >('/phones');
    return res.data;
  }

  async createPhone(payload: SkeletonPhoneCreateInput) {
    const res = await this.api.post<
      SkeletonPhoneCreateInput,
      EmptyQuery,
      SkeletonPhoneType
    >('/phones', { data: payload });
    return res.data;
  }
}
