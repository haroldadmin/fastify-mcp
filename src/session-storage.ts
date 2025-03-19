import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { EventEmitter } from "node:events";

type SessionEvents = {
  connected: [string];
  terminated: [string];
  error: [unknown];
};

export class Sessions extends EventEmitter<SessionEvents> {
  private readonly sessions: Map<string, SSEServerTransport>;

  constructor() {
    super({ captureRejections: true });
    this.sessions = new Map();
  }

  add = (id: string, transport: SSEServerTransport) => {
    if (this.sessions.has(id)) {
      throw new Error("Session already exists");
    }

    this.sessions.set(id, transport);
    this.emit("connected", id);
  };

  remove = (id: string) => {
    this.sessions.delete(id);
    this.emit("terminated", id);
  };

  get = (id: string): SSEServerTransport | undefined => {
    return this.sessions.get(id);
  };

  get count() {
    return this.sessions.size;
  }
}
