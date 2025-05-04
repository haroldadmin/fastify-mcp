import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.d.ts";
import fastify from "fastify";
import { randomUUID } from "node:crypto";
import { createInterface, Interface } from "node:readline";
import { Sessions } from "./session-storage";
import { streamableHttp } from "./streamable-http";

describe(streamableHttp.name, () => {
  const createServer = () => {
    const { server } = new McpServer({ name: "test", version: "1.0.0" });
    return server;
  };

  describe("stateless mode", () => {
    it("should reject GET requests", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: false,
        createServer,
        mcpEndpoint: "/mcp",
      });

      const response = await app.inject({
        method: "GET",
        url: "/mcp",
      });

      expect(response.statusCode).toBe(405);
    });

    it("should reject DELETE requests", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: false,
        createServer,
        mcpEndpoint: "/mcp",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/mcp",
      });

      expect(response.statusCode).toBe(405);
    });

    it("should handle POST requests", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: false,
        createServer,
        mcpEndpoint: "/mcp",
      });

      const response = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: {
              name: "ExampleClient",
              version: "1.0.0",
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/event-stream");

      const rl = createInterface(response.stream());
      const values = await lines(rl);
      expect(values).toEqual([
        "event: message",
        `data: {"result":{"protocolVersion":"2025-03-26","capabilities":{},"serverInfo":{"name":"test","version":"1.0.0"}},"jsonrpc":"2.0","id":1}`,
        "",
      ]);
    });

    it("should not send a session ID header", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: false,
        createServer,
        mcpEndpoint: "/mcp",
      });

      const response = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: {
              name: "ExampleClient",
              version: "1.0.0",
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["mcp-session-id"]).toBeUndefined();
    });
  });

  describe("stateful mode", () => {
    it("should reject a request without a session ID if it it not an initialization request", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "ping",
          params: {},
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: -32000,
        },
      });
    });

    it("should accept a request without a session ID if it is an initialization request", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: {
              name: "ExampleClient",
              version: "1.0.0",
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/event-stream");
      expect(response.headers["mcp-session-id"]).toBeDefined();
    });

    it("should reject a request with a session ID for a non existent session", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": randomUUID(),
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "ping",
          params: {},
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle a request with a session ID for an existing session", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const initResponse = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: {
              name: "ExampleClient",
              version: "1.0.0",
            },
          },
        },
      });

      const sessionId = initResponse.headers["mcp-session-id"];
      expect(sessionId).toBeDefined();

      const pingResponse = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "ping",
          params: {},
        },
      });

      expect(pingResponse.statusCode).toBe(200);
      expect(pingResponse.headers["mcp-session-id"]).toBe(sessionId);
    });

    it("should reject a GET request without a session ID", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/mcp",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject a GET request with a session ID for a non existent session", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/mcp",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-session-id": randomUUID(),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle a GET request with a session ID for an existing session", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const initResponse = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: {
              name: "ExampleClient",
              version: "1.0.0",
            },
          },
        },
      });

      const sessionId = initResponse.headers["mcp-session-id"];
      expect(sessionId).toBeDefined();

      const getResponse = await app.inject({
        method: "GET",
        url: "/mcp",
        headers: {
          accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        payloadAsStream: true,
      });

      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.headers["mcp-session-id"]).toBe(sessionId);
    });

    it("should reject a DELETE request without a session ID", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/mcp",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle a DELETE request with a session ID for an existing session", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/mcp",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-session-id": randomUUID(),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle a DELETE request with a session ID for an existing session", async () => {
      const app = fastify();

      app.register(streamableHttp, {
        stateful: true,
        createServer,
        mcpEndpoint: "/mcp",
        sessions: new Sessions<StreamableHTTPServerTransport>(),
      });

      const initResponse = await app.inject({
        method: "POST",
        url: "/mcp",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: {
              name: "ExampleClient",
              version: "1.0.0",
            },
          },
        },
      });

      const sessionId = initResponse.headers["mcp-session-id"];
      expect(sessionId).toBeDefined();

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: "/mcp",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-session-id": sessionId,
        },
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.headers["mcp-session-id"]).toBe(sessionId);
    });
  });
});

async function lines(reader: Interface) {
  const values: string[] = [];
  for await (const line of reader) {
    values.push(line);
  }
  return values;
}
