import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient } from "./client";
import { NotFoundError, UnauthorizedError, ValidationError } from "./errors";

describe("ApiClient", () => {
  let client: ApiClient;
  const mockBaseUrl = "http://api.example.com";

  beforeEach(() => {
    client = new ApiClient({ baseUrl: mockBaseUrl, defaultTimeoutMs: 1000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should make a successful GET request and unwrap success envelope", async () => {
    const mockData = { id: "ws-1", name: "Engineering Workspace" };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: mockData }),
    } as Response);

    const result = await client.get("/workspaces/ws-1");
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://api.example.com/workspaces/ws-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("should throw ValidationError on HTTP 400 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        error: { code: "VALIDATION_ERROR", message: "Invalid payload input" },
      }),
    } as Response);

    await expect(client.post("/workspaces", {})).rejects.toThrow(ValidationError);
  });

  it("should throw UnauthorizedError on HTTP 401 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }),
    } as Response);

    await expect(client.get("/workspaces")).rejects.toThrow(UnauthorizedError);
  });

  it("should throw NotFoundError on HTTP 404 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        error: { code: "NOT_FOUND", message: "Resource not found" },
      }),
    } as Response);

    await expect(client.get("/workspaces/invalid")).rejects.toThrow(NotFoundError);
  });
});
