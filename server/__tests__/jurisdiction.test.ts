/**
 * server/__tests__/jurisdiction.test.ts
 *
 * Tests for dual-jurisdiction DB routing logic.
 * Uses AsyncLocalStorage directly — no DB connection needed.
 */
import { describe, it, expect } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";

// Replicate the store logic without importing the full db module
const store = new AsyncLocalStorage<"CA" | "US">();

function getJurisdiction(): "CA" | "US" {
  return store.getStore() ?? "CA";
}

function runWithJurisdiction<T>(jur: "CA" | "US", fn: () => T): T {
  return store.run(jur, fn);
}

describe("jurisdiction routing", () => {
  it("defaults to CA when no context is set", () => {
    expect(getJurisdiction()).toBe("CA");
  });

  it("returns CA within a CA context", () => {
    const result = runWithJurisdiction("CA", () => getJurisdiction());
    expect(result).toBe("CA");
  });

  it("returns US within a US context", () => {
    const result = runWithJurisdiction("US", () => getJurisdiction());
    expect(result).toBe("US");
  });

  it("isolates contexts — outer CA unaffected by inner US", () => {
    let outer: string = "";
    runWithJurisdiction("CA", () => {
      runWithJurisdiction("US", () => { /* inner */ });
      outer = getJurisdiction();
    });
    expect(outer).toBe("CA");
  });

  it("async contexts are isolated", async () => {
    const results: string[] = [];
    await Promise.all([
      new Promise<void>(resolve => store.run("CA", () => {
        setTimeout(() => { results.push(getJurisdiction()); resolve(); }, 10);
      })),
      new Promise<void>(resolve => store.run("US", () => {
        setTimeout(() => { results.push(getJurisdiction()); resolve(); }, 5);
      })),
    ]);
    // US resolves first (5ms), CA second (10ms)
    expect(results).toEqual(["US", "CA"]);
  });
});
