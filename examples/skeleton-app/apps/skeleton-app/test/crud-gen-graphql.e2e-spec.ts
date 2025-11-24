import { INestApplication } from '@nestjs/common';
import { expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Crud-gen GraphQL (SQLite) e2e', () => {
  let app: INestApplication;
  let guid: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a user via GraphQL mutation', async () => {
    guid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation CreateUser($input: SkeletonUserCreateInput!) {
            SkeletonModule_createSkeletonUser(input: $input) {
              guid
              email
              firstName
              lastName
            }
          }
        `,
        variables: {
          input: {
            guid,
            firstName: 'GQL',
            lastName: 'User',
            email: 'gql.user@example.com',
            password: 'P@ssw0rd!',
          },
        },
      })
      .expect(200);

    expect(res.body.data.SkeletonModule_createSkeletonUser.guid).toBe(guid);
  });

  it('returns a grid with pagination metadata', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            SkeletonModule_getSkeletonUserGrid(firstName: "GQL") {
              nodes { guid email firstName }
              pageData { count startRow }
            }
          }
        `,
      })
      .expect(200);

    const grid = res.body.data.SkeletonModule_getSkeletonUserGrid;
    expect(Array.isArray(grid.nodes)).toBe(true);
    expect(grid.pageData.count).toBeGreaterThanOrEqual(1);
  });

  it('updates and deletes the user via GraphQL', async () => {
    const updateRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation UpdateUser($guid: UUID!, $input: SkeletonUserUpdateInput!) {
            SkeletonModule_updateSkeletonUser(
              conditions: { guid: $guid }
              input: $input
            ) {
              lastName
            }
          }
        `,
        variables: {
          guid,
          input: { lastName: 'Updated' },
        },
      })
      .expect(200);

    const deletion = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation DeleteUser($guid: UUID!) {
            SkeletonModule_deleteSkeletonUser(conditions: { guid: $guid })
          }
        `,
        variables: { guid },
      })
      .expect(200);

    expect(deletion.body.data.SkeletonModule_deleteSkeletonUser).toBe(true);
  });
});
