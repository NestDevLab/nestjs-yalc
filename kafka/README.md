# @nestjs-yalc/kafka

Kafka helpers for YALC applications.

The package includes an Avro deserializer, Debezium/configuration interfaces,
and a generic controller helper for persisting Kafka-ingested entities through
TypeORM repositories.

## Installation

```bash
npm install @nestjs-yalc/kafka
```

Install Kafka, registry, Nest microservices, and TypeORM dependencies required
by your application runtime.

## Main Exports

- `KafkaAvroDeserializer` for Confluent Schema Registry Avro payloads.
- `KafkaController` for shared entity insert/update/delete helpers.
- Debezium and Kafka configuration interfaces.

## Example

```ts
import { KafkaAvroDeserializer } from '@nestjs-yalc/kafka';

const deserializer = new KafkaAvroDeserializer({
  host: process.env.SCHEMA_REGISTRY_URL,
});
```
