import { Controller, Get } from '@nestjs/common';
import { UsersApiClient } from '@nestjs-yalc/skeleton-module';

@Controller('users-client')
export class UsersClientController {
  constructor(private readonly client: UsersApiClient) {}

  @Get()
  async listUsers() {
    return this.client.listUsers();
  }

  @Get('phones')
  async listPhones() {
    return this.client.listPhones();
  }
}
