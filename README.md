# fastify-mcp

Integrate [Model Context Protocol](https://modelcontextprotocol.io/) servers with your [Fastify](https://www.fastify.dev) app.

Supports the [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) as well as the legacy [HTTP+SSE transport](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports#http-with-sse).

## Usage

First, define your MCP server.

```ts
function createServer() {
  const mcpServer = new McpServer({
    name: "...",
    version: "...",
  });

  mcpServer.tool("...");
  mcpServer.resource("...");

  return mcpServer.server;
}
```

Create a Fastify app and register the plugin.

```ts
import { fastify } from "fastify";
import { streamableHttp } from "fastify-mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = fastify();

app.register(streamableHttp, {
  // Set to `true` if you want a stateful server
  stateful: false,
  mcpEndpoint: "/mcp",
  sessions: new Sessions<StreamableHTTPServerTransport>()
  createServer,
});

app.listen({ port: 8080 });
```

See the [examples](./examples) directory for more detailed examples.

## Installation

```bash
# npm
npm install fastify-mcp

# yarn
yarn add fastify-mcp
```

## Session Management

The official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) does not support managing multiple sessions out of the box, and therefore it's the host server's responsibility to do so.

This package uses an in-memory mapping of each active session against its session ID to manage multiple sessions, as recommended by the MCP SDK examples.

### Session Events

The `Sessions` class emits the following events:

- `connected`: Emitted when a new session is added.
- `terminated`: Emitted when a session is removed.
- `error`: Emitted when an asynchronous event handler throws an error.

```ts
const sessions = new Sessions<StreamableHTTPServerTransport>();

sessions.on("connected", (sessionId) => {
  console.log(`Session ${sessionId} connected`);
});

sessions.on("terminated", (sessionId) => {
  console.log(`Session ${sessionId} terminated`);
});
```

## Contributing

Please file an issue if you encounter a problem when using this package. Pull requests for new features or bug fixes are also welcome.
