import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { EventEmitter } from "node:events";

type SessionEvents = {
  connected: [string];
  terminated: [string];
  error: [unknown];
};

export class Sessions<T extends Transport>
  extends EventEmitter<SessionEvents>
  implements Iterable<T>
{
  private readonly sessions: Map<string, T>;

  constructor() {
    super({ captureRejections: true });
    this.sessions = new Map();
  }

  add = (id: string, transport: T) => {
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

  get = (id: string): T | undefined => {
    return this.sessions.get(id);
  };

  get count() {
    return this.sessions.size;
  }

  [Symbol.iterator]() {
    return this.sessions.values();
  }
}
