import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './apps/skeleton-app/src/app.module';

async function run() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  const res = await request(app.getHttpServer()).post('/graphql').send({
    query: `query {
      queryType: __type(name: "Query") { fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } } }
      mutationType: __type(name: "Mutation") { fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } } }
    }`,
  });
  console.log(JSON.stringify(res.body, null, 2));
  await app.close();
}
run().catch((e) => { console.error(e); process.exit(1); });
