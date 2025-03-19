import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { FastifyPluginCallback, FastifyRequest } from "fastify";
import { Sessions } from "./session-storage";
import { setInterval } from "node:timers";
import { randomUUID } from "node:crypto";

type MCPSSEPluginOptions = {
  server: Server;
  sessions?: Sessions;
  sseEndpoint?: string;
  messagesEndpoint?: string;
  pingInterval?: number;
};

export const fastifyMCPSSE: FastifyPluginCallback<MCPSSEPluginOptions> = (
  fastify,
  options,
  done,
) => {
  const {
    server,
    sessions = new Sessions(),
    sseEndpoint = "/sse",
    messagesEndpoint = "/messages",
    pingInterval = 1000,
  } = options;

  fastify.get(sseEndpoint, async (_, reply) => {
    const transport = new SSEServerTransport(messagesEndpoint, reply.raw);

    const sessionId = transport.sessionId;
    sessions.add(sessionId, transport);

    const stopPings = schedulePings(transport, pingInterval);

    reply.raw.on("close", () => {
      sessions.remove(sessionId);
      stopPings();
    });

    fastify.log.info("Starting new session", { sessionId });
    await server.connect(transport);
  });

  fastify.post(messagesEndpoint, async (req, reply) => {
    const sessionId = extractSessionId(req);
    if (!sessionId) {
      reply.status(400).send({ error: "Invalid session" });
      return;
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      reply.status(400).send({ error: "Invalid session" });
      return;
    }

    await transport.handlePostMessage(req.raw, reply.raw, req.body);
  });

  return done();
};

function extractSessionId(req: FastifyRequest) {
  if (typeof req.query !== "object" || req.query === null) {
    return undefined;
  }

  if ("sessionId" in req.query === false) {
    return undefined;
  }

  const sessionId = req.query["sessionId"];
  if (typeof sessionId !== "string") {
    return undefined;
  }

  return sessionId;
}

function schedulePings(session: SSEServerTransport, intervalMs: number) {
  const timeout = setInterval(() => {
    console.log("pinging", session.sessionId);
    session.send({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "ping",
    });
  }, intervalMs);

  return () => clearInterval(timeout);
}
