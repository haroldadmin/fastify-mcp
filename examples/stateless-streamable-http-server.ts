import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fastify } from "fastify";
import { streamableHttp } from "../src";

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
  stateful: false,
  mcpEndpoint: "/mcp",
  createServer: () => {
    const mcpServer = new McpServer({
      name: "stateless-streamable-http-server",
      version: "0.0.1",
    });

    mcpServer.tool("greet", () => {
      return {
        content: [{ type: "text", text: "Hello, world!" }],
      };
    });

    return mcpServer.server;
  },
});

app
  .listen({
    port: 3000,
  })
  .then(() => {
    console.log("Server is running on port 3000");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
