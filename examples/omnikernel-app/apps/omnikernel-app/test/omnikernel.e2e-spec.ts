import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('OmniKernel App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a document via REST and reads it back through GraphQL', async () => {
    const created = await request(app.getHttpServer())
      .post('/omni/documents')
      .send({
        guid: '66666666-6666-4666-8666-666666666666',
        title: 'REST-created document',
        documentKind: 'note',
        status: 'active',
        content: 'hello omni',
      })
      .expect(201);

    expect(created.body.guid).toBe('66666666-6666-4666-8666-666666666666');

    const restList = await request(app.getHttpServer())
      .get('/omni/documents')
      .expect(200);

    expect(restList.body.list).toHaveLength(1);
    expect(restList.body.list[0].title).toBe('REST-created document');

    const gqlRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query {
          OmniKernel_getOmniDocumentGrid {
            nodes {
              guid
              title
            }
            pageData {
              count
            }
          }
        }`,
      })
      .expect(200);

    expect(gqlRes.body.errors).toBeUndefined();
    expect(gqlRes.body.data.OmniKernel_getOmniDocumentGrid.nodes).toEqual([
      {
        guid: '66666666-6666-4666-8666-666666666666',
        title: 'REST-created document',
      },
    ]);
  });
}
