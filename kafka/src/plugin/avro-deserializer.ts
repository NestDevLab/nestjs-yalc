/* istanbul ignore file */
import { Deserializer, ReadPacket } from '@nestjs/microservices';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import type { SchemaRegistryAPIClientArgs } from '@kafkajs/confluent-schema-registry/dist/api/index.js';
import type { SchemaRegistryAPIClientOptions } from '@kafkajs/confluent-schema-registry/dist/@types.js';
import type { KafkaMessage } from '@nestjs/microservices/external/kafka.interface.js';
import type { DeserializedData } from '../interface/debezium.interface.js';

/**
 * Deserializer for Kafka data by using Avro Schema
 */
export class KafkaAvroDeserializer
  implements Deserializer<KafkaMessage, ReadPacket<DeserializedData<any, any>>>
{
  protected registry: SchemaRegistry;

  constructor(
    config: SchemaRegistryAPIClientArgs,
    options?: SchemaRegistryAPIClientOptions,
  ) {
    this.registry = new SchemaRegistry(config, options);
  }

  /**
   * Deserializer function: The return type must be a ReadPacket type for the purpose of using MessagePattern Nestjs
   * @param message
   * @param _options
   * @returns
   */
  async deserialize(message: any): Promise<ReadPacket> {
    try {
      message.key = message.key
        ? await this.registry.decode(message.key)
        : message.key;
      message.value = message.value
        ? await this.registry.decode(message.value)
        : message.value;
    } catch (e) {
      /* istanbul ignore next */
      // eslint-disable-next-line no-console
      console.error('Deserialization error', e);
    }

    return {
      pattern: message.topic,
      data: {
        value: message.value,
        key: message.key,
      },
    };
  }
}
