import { INestApplication } from '@nestjs/common';
import { expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Crud-gen GraphQL (SQLite in-memory) e2e', () => {
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

  it('returns a derived fullName field on single GraphQL reads when exposed by the example path', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query GetUser($guid: String!) {
            SkeletonModule_getSkeletonUser(guid: $guid) {
              guid
              firstName
              lastName
              fullName
            }
          }
        `,
        variables: { guid },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.SkeletonModule_getSkeletonUser.guid).toBe(guid);
    expect(res.body.data.SkeletonModule_getSkeletonUser.firstName).toBe('GQL');
    expect(res.body.data.SkeletonModule_getSkeletonUser.lastName).toBe('User');
    expect(typeof res.body.data.SkeletonModule_getSkeletonUser.fullName).toBe(
      'string',
    );
    expect(res.body.data.SkeletonModule_getSkeletonUser.fullName).toContain(
      'GQL',
    );
    expect(res.body.data.SkeletonModule_getSkeletonUser.fullName).toContain(
      'User',
    );
  });

  it('rejects unknown inline sort enum fields during document validation', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query {
        SkeletonModule_getSkeletonUserGrid(
          firstName: "GQL", sorting: [{ colId: unknownField, sort: ASC }]
        ) { nodes { guid } }
      }`,
      })
      .expect(400);

    expect(res.body.data).toBeUndefined();
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      message: expect.stringContaining('unknownField'),
      extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
    });
    expect(res.body.errors[0].path).toBeUndefined();
  });

  it('rejects unknown filter enum fields during variable coercion', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query FilterUsers($filters: SkeletonUserTypeFilterExpressionInput) {
          SkeletonModule_getSkeletonUserGrid(firstName: "GQL", filters: $filters) {
            nodes { guid }
          }
        }`,
        variables: {
          filters: {
            expressions: [
              {
                text: {
                  field: 'unknownField',
                  type: 'CONTAINS',
                  filter: 'GQL',
                },
              },
            ],
          },
        },
      })
      .expect(400);

    expect(res.body.data).toBeUndefined();
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      message: expect.stringContaining('unknownField'),
      extensions: { code: 'BAD_USER_INPUT' },
    });
    expect(res.body.errors[0].path).toBeUndefined();
  });

  it('rejects schema-valid structured filters at the plain repository capability boundary', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query FilterUsers($filters: SkeletonUserTypeFilterExpressionInput) {
          SkeletonModule_getSkeletonUserGrid(firstName: "GQL", filters: $filters) {
            nodes { guid }
          }
        }`,
        variables: {
          filters: {
            expressions: [
              {
                text: {
                  field: 'firstName',
                  type: 'CONTAINS',
                  filter: 'GQL',
                },
              },
            ],
          },
        },
      })
      .expect(200);

    expect(res.body.data).toBeNull();
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      message:
        'Structured GraphQL filters require an extended repository; plain TypeORM fallback only supports basic grid queries.',
      path: ['SkeletonModule_getSkeletonUserGrid'],
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });

  it('rejects grid queries without the required extra args', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            SkeletonModule_getSkeletonUserGrid {
              nodes { guid email firstName }
              pageData { count startRow }
            }
          }
        `,
      })
      .expect(200);

    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain(
      'You should provide at least one of the arguments',
    );
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      path: ['SkeletonModule_getSkeletonUserGrid'],
      extensions: { code: 'BAD_REQUEST' },
    });
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
