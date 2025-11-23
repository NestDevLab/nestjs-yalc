import { jest } from '@jest/globals';
import { createMock } from '@golevelup/ts-jest';
import * as confluent from '@kafkajs/confluent-schema-registry';
import { KafkaAvroDeserializer } from '../plugin.js';

jest.mock('@kafkajs/confluent-schema-registry', () => {
  const mockedSchema = createMock<confluent.SchemaRegistry>();
  mockedSchema.decode.mockResolvedValue('decoded');

  return {
    SchemaRegistry: jest.fn(() => mockedSchema),
  };
});

describe('KafkaAvroDeserializer', () => {
  let deserializer = new KafkaAvroDeserializer({}, {});

  it('Should be defined', () => {
    expect(deserializer).toBeDefined();
  });

  it('Should decode message', async () => {
    const result = await deserializer.deserialize({
      key: 'key',
      value: 'value',
      pattern: 'pettern',
    });

    expect(result.data.key).toEqual('decoded');
    expect(result.data.value).toEqual('decoded');
  });

  it('Should not decode message', async () => {
    const result = await deserializer.deserialize({
      key: undefined,
      value: undefined,
      pattern: 'pettern',
    });

    expect(result.data.key).toBeUndefined();
    expect(result.data.value).toBeUndefined();
  });
});
