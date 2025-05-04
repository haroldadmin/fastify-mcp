import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import fastify from "fastify";
import { Sessions, streamableHttp } from "../src";

const app = fastify();

app.register(streamableHttp, {
  stateful: true,
  mcpEndpoint: "/mcp",
  createServer: () => {
    const mcpServer = new McpServer({
      name: "stateful-streamable-http-server",
      version: "0.0.1",
    });

    mcpServer.tool("greet", () => {
      return {
        content: [{ type: "text", text: "Hello, world!" }],
      };
    });

    return mcpServer.server;
  },
  sessions: new Sessions<StreamableHTTPServerTransport>(),
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
