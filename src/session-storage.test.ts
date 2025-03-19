import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Sessions } from "./session-storage";
import { setTimeout } from "node:timers/promises";

describe(Sessions.name, () => {
  it("should be able to add a session", () => {
    const sessions = new Sessions();
    const sessionId = "123";
    const transport = fakeTransport();

    sessions.add(sessionId, transport);

    expect(sessions.get(sessionId)).toBe(transport);
  });

  it("should throw an error if adding a session that already exists", () => {
    const sessions = new Sessions();
    const sessionId = "123";
    const transport = fakeTransport();

    sessions.add(sessionId, transport);

    expect(() => sessions.add(sessionId, transport)).toThrow(
      "Session already exists",
    );
  });

  it("should be able to remove a session", () => {
    const sessions = new Sessions();
    const sessionId = "123";
    const transport = fakeTransport();

    sessions.add(sessionId, transport);
    sessions.remove(sessionId);

    expect(sessions.get(sessionId)).toBeUndefined();
  });

  it("should not throw an error if removing a session that does not exist", () => {
    const sessions = new Sessions();
    const sessionId = "123";

    expect(() => sessions.remove(sessionId)).not.toThrow();
  });

  it("should be able to get a session", () => {
    const sessions = new Sessions();
    const sessionId = "123";
    const transport = fakeTransport();

    sessions.add(sessionId, transport);

    expect(sessions.get(sessionId)).toBe(transport);
  });

  it("should return undefined if getting a session that does not exist", () => {
    const sessions = new Sessions();
    const sessionId = "123";

    expect(sessions.get(sessionId)).toBeUndefined();
  });

  it("should emit a connected event when a session is added", () => {
    const sessions = new Sessions();
    const sessionId = "123";
    const transport = fakeTransport();

    let called = false;
    sessions.on("connected", () => {
      called = true;
    });

    sessions.add(sessionId, transport);

    expect(called).toBe(true);
  });

  it("should emit a terminated event when a session is removed", () => {
    const sessions = new Sessions();
    const sessionId = "123";
    const transport = fakeTransport();

    let called = false;
    sessions.on("terminated", () => {
      called = true;
    });

    sessions.add(sessionId, transport);
    sessions.remove(sessionId);

    expect(called).toBe(true);
  });

  it("should emit an error event when a session throws an error", async () => {
    const sessions = new Sessions();
    const sessionId = "123";
    const transport = fakeTransport();

    let called = false;
    let thrownValue: unknown;

    sessions.on("error", (error) => {
      called = true;
      thrownValue = error;
    });

    sessions.on("connected", async () => {
      throw new Error("test");
    });

    sessions.add(sessionId, transport);

    await setTimeout(0);

    expect(called).toBe(true);
    expect(thrownValue).toBeInstanceOf(Error);
    expect((thrownValue as Error).message).toBe("test");
  });
});

function fakeTransport(): SSEServerTransport {
  return jest.fn() as unknown as SSEServerTransport;
}
