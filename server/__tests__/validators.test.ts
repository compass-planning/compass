/**
 * server/__tests__/validators.test.ts
 * Tests for shared Zod validators — no DB or network required.
 */
import { describe, it, expect } from "vitest";
import { clientCreateSchema, goalCreateSchema, pensionCreateSchema } from "../../shared/validators.js";

describe("clientCreateSchema", () => {
  it("accepts valid client", () => {
    const result = clientCreateSchema.safeParse({
      firstName: "Jane", lastName: "Smith", email: "jane@example.com",
      province: "ON", annualIncome: 95000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing first name", () => {
    const result = clientCreateSchema.safeParse({ lastName: "Smith" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = clientCreateSchema.safeParse({ firstName: "J", lastName: "S", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = clientCreateSchema.safeParse({ firstName: "J", lastName: "S", dateOfBirth: "01/01/1990" });
    expect(result.success).toBe(false);
  });

  it("accepts ISO date format", () => {
    const result = clientCreateSchema.safeParse({ firstName: "J", lastName: "S", dateOfBirth: "1990-01-15" });
    expect(result.success).toBe(true);
  });

  it("rejects negative annual income", () => {
    const result = clientCreateSchema.safeParse({ firstName: "J", lastName: "S", annualIncome: -1000 });
    expect(result.success).toBe(false);
  });
});

describe("goalCreateSchema", () => {
  it("accepts valid goal", () => {
    const result = goalCreateSchema.safeParse({
      clientId: 1, name: "Retirement", type: "retirement", targetAmount: 1000000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid goal type", () => {
    const result = goalCreateSchema.safeParse({
      clientId: 1, name: "Goal", type: "invalid_type", targetAmount: 5000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative target amount", () => {
    const result = goalCreateSchema.safeParse({
      clientId: 1, name: "Goal", type: "travel", targetAmount: -500,
    });
    expect(result.success).toBe(false);
  });
});

describe("pensionCreateSchema", () => {
  it("accepts valid DBPP pension", () => {
    const result = pensionCreateSchema.safeParse({
      clientId: 1, planName: "Teachers Pension", pensionType: "dbpp",
      accrualRate: 2.0, projectedYearsAtRetirement: 25, bestAverageEarnings: 90000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects accrual rate above 5%", () => {
    const result = pensionCreateSchema.safeParse({
      clientId: 1, planName: "Plan", pensionType: "dbpp", accrualRate: 6,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid pension type", () => {
    const result = pensionCreateSchema.safeParse({
      clientId: 1, planName: "Plan", pensionType: "fake_type",
    });
    expect(result.success).toBe(false);
  });
});
