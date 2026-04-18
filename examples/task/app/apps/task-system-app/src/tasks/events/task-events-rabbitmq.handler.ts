import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  TASK_CREATED_EVENT,
  TASK_STATUS_CHANGED_EVENT,
  type TaskDomainEventPayload,
} from '@nestjs-yalc/task-system-module/src/events/tasks-events.client';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { TaskEventsAuditStore } from './task-events-audit.store';
import { closeRabbitResource } from './task-events-rabbitmq-connection';

@Injectable()
export class TaskEventsRabbitMqHandler
  implements OnModuleInit, OnModuleDestroy
{
  private connection?: ChannelModel;
  private channel?: Channel;
  private consumerTag?: string;

  constructor(private readonly audit: TaskEventsAuditStore) {}

  async onModuleInit() {
    if (process.env.TASK_EVENTS_STRATEGY !== 'rabbitmq') {
      return;
    }

    const options = createTaskEventsRabbitMqOptions();
    const queue =
      process.env.TASK_RABBITMQ_QUEUE?.trim() || 'task-system.audit';
    const autoDelete = process.env.TASK_RABBITMQ_QUEUE_AUTO_DELETE === 'true';

    this.connection = await amqp.connect(options.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(options.exchange, 'topic', {
      durable: true,
    });
    await this.channel.assertQueue(queue, {
      durable: !autoDelete,
      autoDelete,
    });
    await this.channel.bindQueue(queue, options.exchange, TASK_CREATED_EVENT);
    await this.channel.bindQueue(
      queue,
      options.exchange,
      TASK_STATUS_CHANGED_EVENT,
    );
    const consumer = await this.channel.consume(queue, (message) =>
      this.handleMessage(message),
    );
    this.consumerTag = consumer.consumerTag;
  }

  async onModuleDestroy() {
    if (this.channel && this.consumerTag) {
      try {
        await this.channel.cancel(this.consumerTag);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('closing')) {
          throw error;
        }
      } finally {
        this.consumerTag = undefined;
      }
    }

    await closeRabbitResource(this.channel);
    await closeRabbitResource(this.connection);
    this.channel = undefined;
    this.connection = undefined;
  }

  private handleMessage(message: ConsumeMessage | null) {
    if (!message || !this.channel) {
      return;
    }

    const payload = JSON.parse(
      message.content.toString('utf8'),
    ) as TaskDomainEventPayload;
    this.audit.record({
      eventName: message.fields.routingKey,
      source: 'rabbitmq',
      payload,
    });
    this.channel.ack(message);
  }
}

function createTaskEventsRabbitMqOptions() {
  const url = process.env.TASK_RABBITMQ_URL?.trim();

  if (!url && process.env.TASK_EVENTS_STRATEGY === 'rabbitmq') {
    throw new Error(
      'TASK_RABBITMQ_URL must be set when TASK_EVENTS_STRATEGY is "rabbitmq".',
    );
  }

  return {
    url: url ?? 'amqp://127.0.0.1:5672',
    exchange:
      process.env.TASK_RABBITMQ_EXCHANGE?.trim() || 'task-system.events',
  };
}
