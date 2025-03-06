import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export class Sessions {
  private readonly sessions: Map<string, SSEServerTransport>;

  constructor() {
    this.sessions = new Map();
  }

  add = (id: string, transport: SSEServerTransport) => {
    if (this.sessions.has(id)) {
      throw new Error("Session already exists");
    }

    this.sessions.set(id, transport);
  };

  remove = (id: string) => {
    this.sessions.delete(id);
  };

  get = (id: string): SSEServerTransport | undefined => {
    return this.sessions.get(id);
  };

  get count() {
    return this.sessions.size;
  }
}
