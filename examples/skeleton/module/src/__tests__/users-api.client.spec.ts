import { describe, expect, it, jest } from '@jest/globals';

const { UsersApiClient } = await import('../client/users-api.client.js');

describe('UsersApiClient', () => {
  it('wraps user and phone calls behind the configured API strategy', async () => {
    const strategy = {
      get: jest.fn<any>().mockImplementation((path: string) => {
        if (path === '/users') {
          return Promise.resolve({ data: { list: [], pageData: { count: 0 } } });
        }
        return Promise.resolve({ data: { list: [], pageData: { count: 0 } } });
      }),
      post: jest.fn<any>().mockImplementation((path: string, options: any) =>
        Promise.resolve({
          data: {
            ...(options.data as Record<string, unknown>),
            path,
          },
        }),
      ),
      call: jest.fn(),
    };
    const client = new UsersApiClient(strategy);

    await expect(client.listUsers()).resolves.toEqual({
      list: [],
      pageData: { count: 0 },
    });
    await expect(client.listPhones()).resolves.toEqual({
      list: [],
      pageData: { count: 0 },
    });
    await expect(
      client.createUser({
        guid: 'user-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        password: 'secret',
      }),
    ).resolves.toMatchObject({ guid: 'user-1', path: '/users' });
    await expect(
      client.createPhone({
        phoneNumber: '123',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({ phoneNumber: '123', path: '/phones' });

    expect(strategy.get).toHaveBeenCalledWith('/users');
    expect(strategy.get).toHaveBeenCalledWith('/phones');
    expect(strategy.post).toHaveBeenCalledWith('/users', {
      data: expect.objectContaining({ guid: 'user-1' }),
    });
    expect(strategy.post).toHaveBeenCalledWith('/phones', {
      data: expect.objectContaining({ phoneNumber: '123' }),
    });
  });
});
