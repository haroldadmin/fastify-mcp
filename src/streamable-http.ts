import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.d.ts";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { FastifyPluginAsync, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { IncomingMessage } from "node:http";
import { Sessions } from "./session-storage";

type StreamableHttpPluginOptions =
  | StatefulStreamableHttpPluginOptions
  | StatelessStreamableHttpPluginOptions;

/**
 * A plugin to run MCP servers using the Streamable HTTP Transport over Fastify.
 * Supports both stateless and stateful sessions.
 *
 * @example
 * ```ts
 * import { fastify } from "fastify";
 * import { streamableHttp } from "@modelcontextprotocol/fastify-streamable-http";
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 *
 * const app = fastify();
 *
 * app.register(streamableHttp, {
 *   stateful: false,
 *   mcpEndpoint: '/mcp',
 *   createServer: () => new McpServer({ name: 'my-server', version: '1.0.0' }).server,
 * });
 *
 * await app.listen({ port: 3000 });
 * ```
 */
export const streamableHttp: FastifyPluginAsync<
  StreamableHttpPluginOptions
> = async (fastify, options) => {
  if (options.stateful) {
    return statefulPlugin(fastify, options);
  }

  return statelessPlugin(fastify, options);
};

type StatelessStreamableHttpPluginOptions = {
  stateful: false;
  mcpEndpoint: string;
  createServer: () => Server | Promise<Server>;
};

const statelessPlugin: FastifyPluginAsync<
  StatelessStreamableHttpPluginOptions
> = async (fastify, options) => {
  const { createServer, mcpEndpoint } = options;

  fastify.post(mcpEndpoint, async (req, reply) => {
    const server = await createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    reply.raw.on("close", async () => {
      await transport.close();
      await server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });

  fastify.get(mcpEndpoint, async (req, reply) => {
    return methodNotAllowed(reply);
  });

  fastify.delete(mcpEndpoint, async (req, reply) => {
    return methodNotAllowed(reply);
  });
};

type StatefulStreamableHttpPluginOptions = {
  stateful: true;
  mcpEndpoint: string;
  createServer: () => Server | Promise<Server>;
  sessions: Sessions<StreamableHTTPServerTransport>;
};

const statefulPlugin: FastifyPluginAsync<
  StatefulStreamableHttpPluginOptions
> = async (fastify, options) => {
  const { createServer, mcpEndpoint, sessions } = options;

  fastify.post(mcpEndpoint, async (req, reply) => {
    const sessionId = req.headers["mcp-session-id"];
    if (Array.isArray(sessionId)) {
      return invalidSessionId(reply);
    }

    if (!sessionId) {
      if (!isInitializeRequest(req.body)) {
        return invalidSessionId(reply);
      }

      const transport = createStatefulTransport(sessions);

      const server = await createServer();
      await server.connect(transport);

      await transport.handleRequest(req.raw, reply.raw, req.body);
    } else {
      const transport = sessions.get(sessionId);
      if (!transport) {
        return invalidSessionId(reply);
      }

      await transport.handleRequest(
        injectAuthData(req.raw),
        reply.raw,
        req.body,
      );
    }
  });

  fastify.get(mcpEndpoint, async (req, reply) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId) {
      return invalidSessionId(reply);
    }

    if (Array.isArray(sessionId)) {
      return invalidSessionId(reply);
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      return invalidSessionId(reply);
    }

    await transport.handleRequest(req.raw, reply.raw, req.body);
  });

  fastify.delete(mcpEndpoint, async (req, reply) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId) {
      return invalidSessionId(reply);
    }

    if (Array.isArray(sessionId)) {
      return invalidSessionId(reply);
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      return invalidSessionId(reply);
    }

    await transport.handleRequest(req.raw, reply.raw, req.body);

    // The SDK never seems to trigger the onclose event, so we
    // should manually remove the session on a DELETE request
    sessions.remove(sessionId);
  });
};

function createStatefulTransport(
  sessions: Sessions<StreamableHTTPServerTransport>,
): StreamableHTTPServerTransport {
  const newTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.add(id, newTransport);
    },
  });

  newTransport.onclose = () => {
    if (!newTransport.sessionId) {
      return;
    }

    sessions.remove(newTransport.sessionId);
  };

  return newTransport;
}

function injectAuthData(reqRaw: IncomingMessage & { auth?: AuthInfo }) {
  const { authorization } = reqRaw.headers;
  if (authorization) {
    reqRaw.auth = { token: authorization } as AuthInfo;
  }
  return reqRaw;
}

function invalidSessionId(reply: FastifyReply): void {
  reply.status(400).send({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Bad Request: No valid session ID provided",
    },
    id: null,
  });
}

function methodNotAllowed(reply: FastifyReply): void {
  reply.status(405).send({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}
