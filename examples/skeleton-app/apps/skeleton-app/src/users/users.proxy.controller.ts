import { Controller, Get } from '@nestjs/common';
import { UsersProxyService } from './users.proxy.service';

@Controller('users-proxy')
export class UsersProxyController {
  constructor(private readonly proxyService: UsersProxyService) {}

  @Get()
  async listUsers() {
    const res = await this.proxyService.fetchUsers();
    return res.data;
  }
}
