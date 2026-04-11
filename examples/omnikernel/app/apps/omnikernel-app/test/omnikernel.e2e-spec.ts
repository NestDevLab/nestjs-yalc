import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('OmniKernel App e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates documents via generated REST and reads them back through GraphQL', async () => {
    const first = await request(app.getHttpServer())
      .post('/omni/documents')
      .send({
        guid: '66666666-6666-4666-8666-666666666666',
        title: 'REST-created document',
        documentKind: 'note',
        status: 'active',
        content: 'hello omni',
      })
      .expect(201);

    expect(first.body.guid).toBe('66666666-6666-4666-8666-666666666666');

    await request(app.getHttpServer())
      .post('/omni/documents')
      .send({
        guid: '77777777-7777-4777-8777-777777777777',
        title: 'Architecture note',
        documentKind: 'note',
        status: 'active',
        content: 'crud rest filtering',
      })
      .expect(201);

    const restList = await request(app.getHttpServer())
      .get('/omni/documents')
      .query({
        sorting: JSON.stringify([{ colId: 'title', sort: 'ASC' }]),
        filters: JSON.stringify({
          expressions: [
            {
              text: {
                field: 'title',
                type: 'contains',
                filter: 'document',
                filterType: 'text',
              },
            },
          ],
        }),
      })
      .expect(200);

    expect(restList.body.list).toEqual([
      expect.objectContaining({
        guid: '66666666-6666-4666-8666-666666666666',
        title: 'REST-created document',
      }),
    ]);

    const gqlRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query {
          OmniKernel_getOmniDocumentEntityGrid {
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
    expect(gqlRes.body.data.OmniKernel_getOmniDocumentEntityGrid.nodes).toEqual(
      expect.arrayContaining([
        {
          guid: '66666666-6666-4666-8666-666666666666',
          title: 'REST-created document',
        },
        {
          guid: '77777777-7777-4777-8777-777777777777',
          title: 'Architecture note',
        },
      ]),
    );
  });

  it('rejects malformed generated REST structured filters', async () => {
    await request(app.getHttpServer())
      .get('/omni/documents')
      .query({ filters: '{bad-json' })
      .expect(400);
  });
});
