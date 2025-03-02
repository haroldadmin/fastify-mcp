import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fastifyMCPSSE } from "../src";
import { fastify } from "fastify";

const mcpServer = new McpServer({
  name: "basic-mcp-server",
  version: "0.0.1",
});

mcpServer.tool("greet", () => {
  return {
    content: [{ type: "text", text: "Hello, world!" }],
  };
});

const app = fastify();

app.register(fastifyMCPSSE, {
  server: mcpServer.server,
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
