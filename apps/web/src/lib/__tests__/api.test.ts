import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api";

describe("api helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiFetch calls API_BASE + path with credentials include", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await apiFetch("/api/auth/me", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/me");
    expect(init?.credentials).toBe("include");
  });
});
