import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.d.ts";
import { fastify } from "fastify";
import { Sessions, streamableHttp } from "../src";

const mcpServer = new McpServer({
  name: "stateless-streamable-http-server",
  version: "0.0.1",
});

mcpServer.tool("greet", () => {
  return {
    content: [{ type: "text", text: "Hello, world!" }],
  };
});

async function main() {
  const app = fastify({
    logger: {
      level: "error",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
  });

  app.register(streamableHttp, {
    stateful: true,
    mcpEndpoint: "/mcp",
    createServer: () => mcpServer.server,
    sessions: new Sessions<StreamableHTTPServerTransport>(),
  });

  await app.listen({
    port: 3000,
  });

  console.log("Server is running on port 3000");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
