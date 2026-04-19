import { INestApplication } from "@nestjs/common";
import { jest } from "@jest/globals";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import amqp from "amqplib";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";

const telemetryPath = join(process.cwd(), "var/otel/telemetry.json");
let telemetryOffset = 0;

jest.setTimeout(60000);

describe("Task System observability e2e", () => {
  let app: INestApplication;
  let previousObservabilityEnabled: string | undefined;
  let previousOtelEndpoint: string | undefined;
  let previousTasksApiStrategy: string | undefined;
  let previousTasksHttpBaseUrl: string | undefined;
  let previousTaskEventsStrategy: string | undefined;
  let previousRabbitUrl: string | undefined;
  let previousRabbitExchange: string | undefined;
  let previousRabbitQueue: string | undefined;
  let previousRabbitQueueAutoDelete: string | undefined;
  let previousRabbitPublishEnabled: string | undefined;

  beforeAll(async () => {
    await waitForUrl("http://127.0.0.1:13133");
    await waitForRabbitMq(
      process.env.TASK_RABBITMQ_URL?.trim() || "amqp://127.0.0.1:5672"
    );
    resetTelemetryFile();

    previousObservabilityEnabled = process.env.YALC_OBSERVABILITY_ENABLED;
    previousOtelEndpoint = process.env.YALC_OTEL_ENDPOINT;
    previousTasksApiStrategy = process.env.TASKS_API_STRATEGY;
    previousTasksHttpBaseUrl = process.env.TASKS_HTTP_BASE_URL;
    previousTaskEventsStrategy = process.env.TASK_EVENTS_STRATEGY;
    previousRabbitUrl = process.env.TASK_RABBITMQ_URL;
    previousRabbitExchange = process.env.TASK_RABBITMQ_EXCHANGE;
    previousRabbitQueue = process.env.TASK_RABBITMQ_QUEUE;
    previousRabbitQueueAutoDelete = process.env.TASK_RABBITMQ_QUEUE_AUTO_DELETE;
    previousRabbitPublishEnabled = process.env.TASK_RABBITMQ_PUBLISH_ENABLED;

    process.env.YALC_OBSERVABILITY_ENABLED = "true";
    process.env.YALC_OTEL_ENDPOINT = "http://127.0.0.1:4318";
    process.env.TASKS_API_STRATEGY = "http";
    process.env.TASKS_HTTP_BASE_URL = "http://127.0.0.1:3000";
    process.env.TASK_EVENTS_STRATEGY = "rabbitmq";
    process.env.TASK_RABBITMQ_URL =
      process.env.TASK_RABBITMQ_URL?.trim() || "amqp://127.0.0.1:5672";
    process.env.TASK_RABBITMQ_EXCHANGE = "task-system.observability.e2e";
    process.env.TASK_RABBITMQ_QUEUE = `task-system.observability.${randomUUID()}`;
    process.env.TASK_RABBITMQ_QUEUE_AUTO_DELETE = "true";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port =
      typeof address === "object" && address?.port ? address.port : 0;
    process.env.TASKS_HTTP_BASE_URL = `http://127.0.0.1:${port}`;
    (app.get("TASKS_CLIENT_HTTP_API_STRATEGY") as any).baseUrl =
      process.env.TASKS_HTTP_BASE_URL;
  });

  afterAll(async () => {
    await app?.close();

    restoreEnv("YALC_OBSERVABILITY_ENABLED", previousObservabilityEnabled);
    restoreEnv("YALC_OTEL_ENDPOINT", previousOtelEndpoint);
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

  beforeEach(() => {
    resetTelemetryFile();
  });

  it("exports workflow, strategy, event, error, and RabbitMQ telemetry", async () => {
    const projectGuid = randomUUID();
    const taskGuid = randomUUID();

    await request(app.getHttpServer())
      .post("/task-workflows/project-with-task")
      .send({
        project: {
          guid: projectGuid,
          name: "Observable project",
          description: "Created to validate OpenTelemetry export",
          status: "active",
        },
        task: {
          guid: taskGuid,
          title: "Observable task",
          description: "Created to validate OpenTelemetry export",
          status: "todo",
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/task-workflows/tasks/${taskGuid}/complete`)
      .expect(200);

    await request(app.getHttpServer())
      .get("/tasks/errors/bad-request")
      .expect(400);

    const expectedTelemetry = [
      "task-workflows.project-with-task",
      "task-workflows.complete-task",
      "api-strategy.tasks-client.http",
      "event-strategy.tasks-events.rabbitmq",
      "task-system.tasks.created",
      "tasks.validation.failed",
    ];
    const telemetry = await waitForTelemetry(expectedTelemetry);

    for (const expected of expectedTelemetry) {
      expect(telemetry).toContain(expected);
    }
  });

  it("keeps local observability when RabbitMQ publishing is disabled", async () => {
    const taskGuid = randomUUID();
    process.env.TASK_RABBITMQ_PUBLISH_ENABLED = "false";

    await request(app.getHttpServer())
      .post("/task-workflows/project-with-task")
      .send({
        project: {
          guid: randomUUID(),
          name: "Local observable project",
          description: "Created with RabbitMQ publishing disabled",
          status: "active",
        },
        task: {
          guid: taskGuid,
          title: "Local observable task",
          description: "Created with RabbitMQ publishing disabled",
          status: "todo",
        },
      })
      .expect(201);

    const expectedTelemetry = [
      "event-strategy.tasks-events.local",
      "task-system.tasks.created",
    ];
    const telemetry = await waitForTelemetry(expectedTelemetry);

    for (const expected of expectedTelemetry) {
      expect(telemetry).toContain(expected);
    }
    delete process.env.TASK_RABBITMQ_PUBLISH_ENABLED;
  });
});

async function waitForUrl(url: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await delay(1000);
  }

  throw new Error(
    `OpenTelemetry Collector is not reachable: ${String(lastError)}`
  );
}

async function waitForRabbitMq(url: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const connection = await amqp.connect(url);
      await connection.close();
      return;
    } catch (error) {
      lastError = error;
      await delay(1000);
    }
  }

  throw new Error(`RabbitMQ is not reachable: ${String(lastError)}`);
}

async function waitForTelemetry(expected: string[]) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const content = existsSync(telemetryPath)
      ? readFileSync(telemetryPath, "utf8").slice(telemetryOffset)
      : "";

    if (expected.every((value) => content.includes(value))) {
      return content;
    }

    await delay(500);
  }

  return existsSync(telemetryPath)
    ? readFileSync(telemetryPath, "utf8").slice(telemetryOffset)
    : "";
}

function resetTelemetryFile() {
  if (existsSync(telemetryPath)) {
    telemetryOffset = readFileSync(telemetryPath, "utf8").length;
    return;
  }

  telemetryOffset = 0;
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

async function delay(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
