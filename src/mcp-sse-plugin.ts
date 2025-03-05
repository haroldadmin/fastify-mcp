import type { Server } from "@modelcontextprotocol/sdk/server/index";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";
import { FastifyPluginCallback, FastifyRequest } from "fastify";
import { Sessions } from "./session-storage";

type MCPSSEPluginOptions = {
  server: Server;
  sessions?: Sessions;
  sseEndpoint?: string;
  messagesEndpoint?: string;
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
  } = options;

  fastify.get(sseEndpoint, async (_, reply) => {
    const transport = new SSEServerTransport(messagesEndpoint, reply.raw);
    const sessionId = transport.sessionId;

    sessions.add(sessionId, transport);

    reply.raw.on("close", () => {
      sessions.remove(sessionId);
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
