import { createServer } from "node:http";
import { createServer as createTcpServer, type AddressInfo } from "node:net";
import { chmod, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { afterEach, describe, expect, it } from "@jest/globals";
import {
  fileProbe,
  heartbeatFileProbe,
  httpProbe,
  mcpProbe,
  runGenericProbe,
  sqliteReadonlyProbe,
  tcpProbe,
} from "../probes.js";
import type { CheckDefinition } from "../types.js";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve()))
      )
  );
});

async function serve(
  handler: Parameters<typeof createServer>[0]
): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function definition(
  kind: string,
  target: Record<string, unknown>,
  timeoutMs = 200
): CheckDefinition {
  return {
    key: "example",
    group: "test",
    title: "Example",
    kind,
    target,
    intervalSeconds: 60,
    timeoutMs,
    severity: "warning",
  };
}

describe("read-only HTTP and MCP probes", () => {
  it("uses GET for HTTP and reports unexpected status", async () => {
    const methods: string[] = [];
    const url = await serve((request, response) => {
      methods.push(request.method ?? "");
      response.writeHead(503);
      response.end();
    });
    const result = await httpProbe({ url }, new AbortController().signal);
    expect(methods).toEqual(["GET"]);
    expect(result.errorClass).toBe("http5xx");
    expect(
      (await httpProbe({ url, status: 503 }, new AbortController().signal))
        .status
    ).toBe("ok");
    expect(
      (await httpProbe({ url, status: 201 }, new AbortController().signal))
        .errorClass
    ).toBe("http5xx");
    expect(
      (await runGenericProbe(definition("http", { url, status: 503 }))).status
    ).toBe("ok");
  });

  it("classifies a 4xx HTTP response separately", async () => {
    const url = await serve((_request, response) => {
      response.writeHead(404);
      response.end();
    });
    expect(
      (await httpProbe({ url }, new AbortController().signal)).errorClass
    ).toBe("protocol");
  });

  it("classifies a 202 tool call as a protocol defect", async () => {
    const url = await serve(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const method = (JSON.parse(body) as { method: string }).method;
      if (method === "notifications/initialized") {
        response.writeHead(202);
        response.end();
        return;
      }
      if (method === "tools/call") {
        response.writeHead(202);
        response.end();
        return;
      }
      response.setHeader("content-type", "application/json");
      response.setHeader("mcp-session-id", "synthetic");
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: method === "initialize" ? 1 : 2,
          result:
            method === "initialize"
              ? { protocolVersion: "2025-03-26" }
              : { tools: [{ name: "read-status" }] },
        })
      );
    });
    const result = await mcpProbe(
      { url, minTools: 1, safeTool: "read-status" },
      new AbortController().signal
    );
    expect(result.status).toBe("warn");
    expect(result.errorClass).toBe("protocol");
  });

  it("does not exceed its deadline when the fake MCP server never responds", async () => {
    const url = await serve(() => undefined);
    const start = Date.now();
    const result = await runGenericProbe(
      definition("mcp-streamable-http", { url }, 50)
    );
    expect(result.errorClass).toBe("timeout");
    expect(Date.now() - start).toBeLessThan(200);
  });

  it("recognizes a compliant MCP inventory and rejects a missing tool", async () => {
    const url = await serve(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const message = JSON.parse(body) as { id?: number; method: string };
      if (!message.id) {
        response.writeHead(204);
        response.end();
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result:
            message.method === "tools/list"
              ? { tools: [{ name: "read-status" }] }
              : {},
        })
      );
    });
    expect(
      (
        await mcpProbe(
          { url, requiredTools: ["read-status"], safeTool: "read-status" },
          new AbortController().signal
        )
      ).status
    ).toBe("ok");
    expect(
      (
        await mcpProbe(
          { url, requiredTools: ["absent"] },
          new AbortController().signal
        )
      ).errorClass
    ).toBe("missing");
  });

  it("classifies a non-compliant initialization", async () => {
    const url = await serve((_request, response) => {
      response.writeHead(202);
      response.end();
    });
    expect(
      (await mcpProbe({ url }, new AbortController().signal)).errorClass
    ).toBe("protocol");
  });

  it("classifies a 202 tools/list response", async () => {
    const url = await serve(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const method = (JSON.parse(body) as { method: string }).method;
      if (method === "initialize") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }));
        return;
      }
      response.writeHead(202);
      response.end();
    });
    expect(
      (await mcpProbe({ url }, new AbortController().signal)).errorClass
    ).toBe("protocol");
  });

  it("accepts an MCP SSE response on POST", async () => {
    const url = await serve(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const message = JSON.parse(body) as { id?: number; method: string };
      if (!message.id) {
        response.writeHead(204);
        response.end();
        return;
      }
      response.setHeader("content-type", "text/event-stream");
      response.end(
        `data: ${JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result:
            message.method === "tools/list"
              ? { tools: [{ name: "read" }] }
              : {},
        })}\n\n`
      );
    });
    expect(
      (await mcpProbe({ url, minTools: 1 }, new AbortController().signal))
        .status
    ).toBe("ok");
  });

  it("rejects an empty MCP response body", async () => {
    const url = await serve((_request, response) => {
      response.writeHead(200);
      response.end();
    });
    expect(
      (await mcpProbe({ url }, new AbortController().signal)).errorClass
    ).toBe("protocol");
  });

  it("uses TCP connect without application writes", async () => {
    const server = createTcpServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const port = (server.address() as AddressInfo).port;
    expect(
      (
        await tcpProbe(
          { host: "127.0.0.1", port },
          new AbortController().signal
        )
      ).status
    ).toBe("ok");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(
      (
        await tcpProbe(
          { host: "127.0.0.1", port },
          new AbortController().signal
        )
      ).status
    ).toBe("fail");
    expect(
      (await runGenericProbe(definition("tcp", { host: "127.0.0.1", port: 0 })))
        .status
    ).toBe("fail");
    const controller = new AbortController();
    const pending = tcpProbe(
      { host: "192.0.2.1", port: 1234 },
      controller.signal
    );
    controller.abort();
    expect((await pending).errorClass).toBe("timeout");
  });

  it("reads file metadata and heartbeat content without modifying the file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "health-probe-"));
    const path = join(dir, "heartbeat.json");
    const link = join(dir, "link");
    await writeFile(
      path,
      JSON.stringify({ status: "ok", lastSuccessAt: new Date().toISOString() })
    );
    await chmod(path, 0o600);
    await symlink(path, link);
    expect((await fileProbe({ path: link, mode: 0o600 })).status).toBe("ok");
    expect((await heartbeatFileProbe({ path, maxAgeMs: 60000 })).status).toBe(
      "ok"
    );
    expect(
      (await runGenericProbe(definition("file", { path, mode: 0o600 }))).status
    ).toBe("ok");
    expect(
      (
        await runGenericProbe(
          definition("heartbeat-file", { path, maxAgeMs: 60000 })
        )
      ).status
    ).toBe("ok");
    expect((await fileProbe({ path, mode: 0o644 })).status).toBe("fail");
    expect((await fileProbe({ path, maxAgeMs: -1 })).errorClass).toBe("stale");
    expect((await heartbeatFileProbe({ path, maxAgeMs: -1 })).errorClass).toBe(
      "stale"
    );
    await writeFile(
      path,
      JSON.stringify({ status: "fail", lastSuccessAt: "bad" })
    );
    expect(
      (await heartbeatFileProbe({ path, maxAgeMs: 60000 })).errorClass
    ).toBe("stale");
    await writeFile(path, JSON.stringify({ status: "ok" }));
    expect(
      (await heartbeatFileProbe({ path, maxAgeMs: 60000 })).errorClass
    ).toBe("stale");
  });

  it("opens SQLite in read-only mode and rejects write statements", async () => {
    const dir = await mkdtemp(join(tmpdir(), "health-sqlite-"));
    const path = join(dir, "data.sqlite");
    const source = new DataSource({
      type: "sqlite",
      database: path,
      entities: [],
      synchronize: false,
    });
    await source.initialize();
    await source.query("CREATE TABLE samples (value INTEGER)");
    await source.query("INSERT INTO samples (value) VALUES (1)");
    await source.destroy();
    expect(
      (
        await sqliteReadonlyProbe(
          { path, query: "SELECT value FROM samples" },
          new AbortController().signal
        )
      ).status
    ).toBe("ok");
    expect(
      (
        await sqliteReadonlyProbe(
          { path, query: "SELECT value FROM samples WHERE value = 2" },
          new AbortController().signal
        )
      ).status
    ).toBe("unknown");
    await expect(
      sqliteReadonlyProbe(
        { path, query: "SELECT missing FROM samples" },
        new AbortController().signal
      )
    ).rejects.toThrow();
    expect(
      (
        await runGenericProbe(
          definition("sqlite-readonly-query", {
            path,
            query: "DELETE FROM samples",
          })
        )
      ).status
    ).toBe("fail");
    expect(
      (
        await runGenericProbe(
          definition("sqlite-readonly-query", {
            path: `${path}.missing`,
            query: "SELECT 1",
          })
        )
      ).status
    ).toBe("fail");
    expect(
      (await runGenericProbe(definition("service-report", {}))).status
    ).toBe("unknown");
    expect((await runGenericProbe(definition("http", {}))).status).toBe("fail");
    const controller = new AbortController();
    const slow = sqliteReadonlyProbe(
      {
        path,
        query:
          "SELECT count(*) FROM (WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 100000000) SELECT n FROM seq)",
      },
      controller.signal
    );
    setTimeout(() => controller.abort(), 5);
    await expect(slow).rejects.toThrow("deadline");
  });
});
