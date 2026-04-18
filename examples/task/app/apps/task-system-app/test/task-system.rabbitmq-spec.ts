import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import amqp from "amqplib";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TaskEventsAuditStore } from "../src/tasks/events/task-events-audit.store";
import {
  TASK_CREATED_EVENT,
  TASK_STATUS_CHANGED_EVENT,
} from "@nestjs-yalc/task-system-module/src/events/tasks-events.client";

async function waitForRabbitMq(url: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const connection = await amqp.connect(url);
      await connection.close();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `RabbitMQ is not reachable at ${url}. Start it with "npm run rabbitmq:up --prefix examples/task/app". Cause: ${String(
      lastError
    )}`
  );
}

describe("Task System RabbitMQ events e2e", () => {
  let app: INestApplication;
  let audit: TaskEventsAuditStore;
  let previousTasksApiStrategy: string | undefined;
  let previousTasksHttpBaseUrl: string | undefined;
  let previousTaskEventsStrategy: string | undefined;
  let previousRabbitUrl: string | undefined;
  let previousRabbitExchange: string | undefined;
  let previousRabbitQueue: string | undefined;
  let previousRabbitQueueAutoDelete: string | undefined;
  let previousRabbitPublishEnabled: string | undefined;

  beforeAll(async () => {
    const rabbitUrl =
      process.env.TASK_RABBITMQ_URL?.trim() || "amqp://127.0.0.1:5672";
    await waitForRabbitMq(rabbitUrl);

    previousTasksApiStrategy = process.env.TASKS_API_STRATEGY;
    previousTasksHttpBaseUrl = process.env.TASKS_HTTP_BASE_URL;
    previousTaskEventsStrategy = process.env.TASK_EVENTS_STRATEGY;
    previousRabbitUrl = process.env.TASK_RABBITMQ_URL;
    previousRabbitExchange = process.env.TASK_RABBITMQ_EXCHANGE;
    previousRabbitQueue = process.env.TASK_RABBITMQ_QUEUE;
    previousRabbitQueueAutoDelete = process.env.TASK_RABBITMQ_QUEUE_AUTO_DELETE;
    previousRabbitPublishEnabled = process.env.TASK_RABBITMQ_PUBLISH_ENABLED;

    process.env.TASKS_API_STRATEGY = "http";
    process.env.TASKS_HTTP_BASE_URL = "http://127.0.0.1:3000";
    process.env.TASK_EVENTS_STRATEGY = "rabbitmq";
    process.env.TASK_RABBITMQ_URL = rabbitUrl;
    process.env.TASK_RABBITMQ_EXCHANGE = "task-system.events.e2e";
    process.env.TASK_RABBITMQ_QUEUE = `task-system.audit.${randomUUID()}`;
    process.env.TASK_RABBITMQ_QUEUE_AUTO_DELETE = "true";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port =
      typeof address === "object" && address?.port ? address.port : 0;
    process.env.TASKS_HTTP_BASE_URL = `http://127.0.0.1:${port}`;
    (app.get("TASKS_CLIENT_HTTP_API_STRATEGY") as any).baseUrl =
      process.env.TASKS_HTTP_BASE_URL;
    audit = app.get(TaskEventsAuditStore);
    audit.clear();
  });

  afterAll(async () => {
    await app?.close();

    restoreEnv("TASKS_API_STRATEGY", previousTasksApiStrategy);
    restoreEnv("TASKS_HTTP_BASE_URL", previousTasksHttpBaseUrl);
    restoreEnv("TASK_EVENTS_STRATEGY", previousTaskEventsStrategy);
    restoreEnv("TASK_RABBITMQ_URL", previousRabbitUrl);
    restoreEnv("TASK_RABBITMQ_EXCHANGE", previousRabbitExchange);
    restoreEnv("TASK_RABBITMQ_QUEUE", previousRabbitQueue);
    restoreEnv(
      "TASK_RABBITMQ_QUEUE_AUTO_DELETE",
      previousRabbitQueueAutoDelete
    );
    restoreEnv("TASK_RABBITMQ_PUBLISH_ENABLED", previousRabbitPublishEnabled);
  });

  it("publishes workflow domain events through RabbitMQ and consumes them back", async () => {
    const projectGuid = randomUUID();
    const taskGuid = randomUUID();

    const createWorkflow = await request(app.getHttpServer())
      .post("/task-workflows/project-with-task")
      .send({
        project: {
          guid: projectGuid,
          name: "RabbitMQ workflow project",
          description: "Created through RabbitMQ event strategy e2e",
          status: "active",
        },
        task: {
          guid: taskGuid,
          title: "RabbitMQ workflow task",
          description: "Published through RabbitMQ",
          status: "todo",
        },
      })
      .expect(201);

    expect(createWorkflow.body.task.guid).toBe(taskGuid);

    const localCreatedEvent = await audit.waitFor(
      (event) =>
        event.source === "local" &&
        event.eventName === TASK_CREATED_EVENT &&
        event.payload.taskId === taskGuid
    );
    expect(localCreatedEvent.payload).toMatchObject({
      eventName: TASK_CREATED_EVENT,
      taskId: taskGuid,
      projectId: projectGuid,
    });

    const createdEvent = await audit.waitFor(
      (event) =>
        event.source === "rabbitmq" &&
        event.eventName === TASK_CREATED_EVENT &&
        event.payload.taskId === taskGuid
    );
    expect(createdEvent.payload).toMatchObject({
      eventName: TASK_CREATED_EVENT,
      taskId: taskGuid,
      projectId: projectGuid,
    });

    await request(app.getHttpServer())
      .put(`/task-workflows/tasks/${taskGuid}/complete`)
      .expect(200);

    const localStatusChangedEvent = await audit.waitFor(
      (event) =>
        event.source === "local" &&
        event.eventName === TASK_STATUS_CHANGED_EVENT &&
        event.payload.taskId === taskGuid
    );
    expect(localStatusChangedEvent.payload).toMatchObject({
      eventName: TASK_STATUS_CHANGED_EVENT,
      taskId: taskGuid,
      status: "done",
    });

    const statusChangedEvent = await audit.waitFor(
      (event) =>
        event.source === "rabbitmq" &&
        event.eventName === TASK_STATUS_CHANGED_EVENT &&
        event.payload.taskId === taskGuid
    );
    expect(statusChangedEvent.payload).toMatchObject({
      eventName: TASK_STATUS_CHANGED_EVENT,
      taskId: taskGuid,
      status: "done",
    });
  });

  it("can disable RabbitMQ publishing while keeping local event handlers active", async () => {
    const projectGuid = randomUUID();
    const taskGuid = randomUUID();
    audit.clear();
    process.env.TASK_RABBITMQ_PUBLISH_ENABLED = "false";

    await request(app.getHttpServer())
      .post("/task-workflows/project-with-task")
      .send({
        project: {
          guid: projectGuid,
          name: "RabbitMQ disabled project",
          description: "Created with RabbitMQ publish disabled",
          status: "active",
        },
        task: {
          guid: taskGuid,
          title: "RabbitMQ disabled task",
          description: "Should stay local only",
          status: "todo",
        },
      })
      .expect(201);

    const localCreatedEvent = await audit.waitFor(
      (event) =>
        event.source === "local" &&
        event.eventName === TASK_CREATED_EVENT &&
        event.payload.taskId === taskGuid
    );
    expect(localCreatedEvent.payload).toMatchObject({
      eventName: TASK_CREATED_EVENT,
      taskId: taskGuid,
      projectId: projectGuid,
    });

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(
      audit
        .list()
        .some(
          (event) =>
            event.source === "rabbitmq" &&
            event.eventName === TASK_CREATED_EVENT &&
            event.payload.taskId === taskGuid
        )
    ).toBe(false);

    delete process.env.TASK_RABBITMQ_PUBLISH_ENABLED;
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
