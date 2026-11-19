import React from "react";

/**
 * nwPayments.tsx
 * Payment-frequency, property-tax and car-loan helpers + form fields shared by the
 * Net Worth tab. Everything is stored inside the existing `metadata` JSON column of
 * net_worth_entries, so no database migration is needed.
 *
 * Every payment is also stored as `monthlyPayment` (monthly equivalent) because the
 * debt / cash-flow code on the server already reads that key.
 */

export type PayFreq = "monthly" | "semi_monthly" | "bi_weekly" | "weekly";
export type TaxFreq = "monthly" | "quarterly" | "semi_annual" | "annual" | "with_mortgage";

export const PAY_FREQS: { v: PayFreq; l: string; short: string; perYear: number }[] = [
  { v: "monthly", l: "Monthly", short: "monthly", perYear: 12 },
  { v: "semi_monthly", l: "Semi-monthly (2x / month)", short: "semi-monthly", perYear: 24 },
  { v: "bi_weekly", l: "Bi-weekly (every 2 weeks)", short: "bi-weekly", perYear: 26 },
  { v: "weekly", l: "Weekly", short: "weekly", perYear: 52 },
];

export const TAX_FREQS: { v: TaxFreq; l: string; perYear: number }[] = [
  { v: "monthly", l: "Monthly", perYear: 12 },
  { v: "quarterly", l: "Quarterly", perYear: 4 },
  { v: "semi_annual", l: "Semi-annual", perYear: 2 },
  { v: "annual", l: "Annual", perYear: 1 },
  { v: "with_mortgage", l: "Included with mortgage", perYear: 0 },
];

export interface PayFields {
  mortgageBalance: string;
  mortgageMonthlyPayment: string; // payment amount PER PERIOD (name kept for backwards compatibility)
  mortgageFreq: string;
  taxAmount: string;
  taxFreq: string;
  vehicleValue: string;
  financeAmount: string;
  interestRate: string;
  termMonths: string;
  termLeftMonths: string;
  loanPayment: string;
  loanFreq: string;
  // Vehicle (asset): balance still owing on it -> auto-creates a linked Car Loan liability
  vehicleBalance: string;
  // Credit Card (liability)
  ccLimit: string;
  ccRate: string;
  ccPayment: string;
  ccFreq: string;
}

export const EMPTY_PAY: PayFields = {
  mortgageBalance: "",
  mortgageMonthlyPayment: "",
  mortgageFreq: "monthly",
  taxAmount: "",
  taxFreq: "annual",
  vehicleValue: "",
  financeAmount: "",
  interestRate: "",
  termMonths: "",
  termLeftMonths: "",
  loanPayment: "",
  loanFreq: "monthly",
  vehicleBalance: "",
  ccLimit: "",
  ccRate: "",
  ccPayment: "",
  ccFreq: "monthly",
};

export const isPropertyCat = (c?: string) =>
  c === "Principal Residence" || c === "Real Estate (other)";

export const isVehicleCat = (c?: string) => c === "Vehicle";

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export function perYear(freq?: string): number {
  return PAY_FREQS.find((f) => f.v === freq)?.perYear ?? 12;
}
export function freqShort(freq?: string): string {
  return PAY_FREQS.find((f) => f.v === freq)?.short ?? "monthly";
}
/** Convert a per-period payment into its monthly equivalent. */
export function toMonthly(amount: number, freq?: string): number {
  return (amount * perYear(freq)) / 12;
}
export function annualTax(amount: number, freq?: string): number {
  const p = TAX_FREQS.find((f) => f.v === freq)?.perYear ?? 0;
  return amount * p;
}
/** Standard amortisation estimate: payment per period for a loan. */
export function estimatePayment(
  principal: number,
  ratePct: number,
  termMonths: number,
  freq?: string
): number | null {
  const ppy = perYear(freq);
  const n = Math.round((termMonths / 12) * ppy);
  if (principal <= 0 || n <= 0) return null;
  const r = ratePct / 100 / ppy;
  if (r <= 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Read the payment-related form fields back out of an entry's metadata. */
export function payFromMeta(category: string, m: any): Partial<PayFields> {
  m = m ?? {};
  const out: Partial<PayFields> = {};
  if (isPropertyCat(category)) {
    out.mortgageMonthlyPayment = m.mortgagePayment != null ? String(m.mortgagePayment) : "";
    out.mortgageFreq = m.mortgagePaymentFrequency ?? "monthly";
    out.taxAmount = m.propertyTax?.amount != null ? String(m.propertyTax.amount) : "";
    out.taxFreq = m.propertyTax?.frequency ?? "annual";
  } else if (category === "Mortgage") {
    out.mortgageMonthlyPayment =
      m.payment != null ? String(m.payment) : m.monthlyPayment != null ? String(m.monthlyPayment) : "";
    out.mortgageFreq = m.paymentFrequency ?? "monthly";
  } else if (category === "Car Loan") {
    out.vehicleValue = m.vehicleValue != null ? String(m.vehicleValue) : "";
    out.financeAmount = m.financeAmount != null ? String(m.financeAmount) : "";
    out.interestRate = m.interestRate != null ? String(m.interestRate) : "";
    out.termMonths = m.termMonths != null ? String(m.termMonths) : "";
    out.termLeftMonths = m.termLeftMonths != null ? String(m.termLeftMonths) : "";
    out.loanPayment =
      m.payment != null ? String(m.payment) : m.monthlyPayment != null ? String(m.monthlyPayment) : "";
    out.loanFreq = m.paymentFrequency ?? "monthly";
  } else if (category === "Credit Card") {
    out.ccLimit = m.creditLimit != null ? String(m.creditLimit) : "";
    out.ccRate = m.interestRate != null ? String(m.interestRate) : "";
    out.ccPayment =
      m.payment != null ? String(m.payment) : m.monthlyPayment != null ? String(m.monthlyPayment) : "";
    out.ccFreq = m.paymentFrequency ?? "monthly";
  }
  return out;
}

/** Merge payment-related metadata for an entry into `m` (mutates and returns it). */
export function applyPayMeta(m: Record<string, any>, category: string, f: Partial<PayFields>) {
  if (isPropertyCat(category)) {
    const pay = num(f.mortgageMonthlyPayment);
    if (pay > 0) {
      m.mortgagePayment = String(pay);
      m.mortgagePaymentFrequency = f.mortgageFreq || "monthly";
    }
    if (f.taxFreq === "with_mortgage") {
      m.propertyTax = { frequency: "with_mortgage" };
    } else if (num(f.taxAmount) > 0) {
      m.propertyTax = { amount: String(num(f.taxAmount)), frequency: f.taxFreq || "annual" };
      m.annualPropertyTax = r2(annualTax(num(f.taxAmount), f.taxFreq));
    }
  } else if (category === "Mortgage") {
    delete m.monthlyPayment;
    const pay = num(f.mortgageMonthlyPayment);
    if (pay > 0) {
      m.payment = String(pay);
      m.paymentFrequency = f.mortgageFreq || "monthly";
      m.monthlyPayment = String(r2(toMonthly(pay, f.mortgageFreq)));
    }
  } else if (category === "Car Loan") {
    delete m.monthlyPayment;
    if (num(f.vehicleValue) > 0) m.vehicleValue = String(num(f.vehicleValue));
    if (num(f.financeAmount) > 0) m.financeAmount = String(num(f.financeAmount));
    if (f.interestRate !== "" && f.interestRate != null) m.interestRate = String(num(f.interestRate));
    if (num(f.termMonths) > 0) m.termMonths = String(Math.round(num(f.termMonths)));
    if (f.termLeftMonths !== "" && f.termLeftMonths != null)
      m.termLeftMonths = String(Math.round(num(f.termLeftMonths)));
    const pay = num(f.loanPayment);
    if (pay > 0) {
      m.payment = String(pay);
      m.paymentFrequency = f.loanFreq || "monthly";
      m.monthlyPayment = String(r2(toMonthly(pay, f.loanFreq)));
    }
  } else if (category === "Credit Card") {
    delete m.monthlyPayment;
    if (num(f.ccLimit) > 0) m.creditLimit = String(num(f.ccLimit));
    if (f.ccRate !== "" && f.ccRate != null) m.interestRate = String(num(f.ccRate));
    const pay = num(f.ccPayment);
    if (pay > 0) {
      m.payment = String(pay);
      m.paymentFrequency = f.ccFreq || "monthly";
      m.monthlyPayment = String(r2(toMonthly(pay, f.ccFreq)));
    }
  }
  return m;
}

/** Metadata for the Car Loan liability that is auto-created / kept in sync with a Vehicle asset. */
export function buildLinkedLoanMeta(vehicleName: string, vehicleValue: any, f: Partial<PayFields>, vehicleId?: number | string) {
  const m: Record<string, any> = { linkedAssetName: vehicleName };
  if (vehicleId != null) m.linkedAssetId = Number(vehicleId);
  if (num(vehicleValue) > 0) m.vehicleValue = String(num(vehicleValue));
  if (num(f.vehicleBalance) > 0) m.financeAmount = String(num(f.vehicleBalance));
  if (f.interestRate !== "" && f.interestRate != null) m.interestRate = String(num(f.interestRate));
  if (num(f.termMonths) > 0) m.termMonths = String(Math.round(num(f.termMonths)));
  if (f.termLeftMonths !== "" && f.termLeftMonths != null) m.termLeftMonths = String(Math.round(num(f.termLeftMonths)));
  const pay = num(f.loanPayment);
  if (pay > 0) {
    m.payment = String(pay);
    m.paymentFrequency = f.loanFreq || "monthly";
    m.monthlyPayment = String(r2(toMonthly(pay, f.loanFreq)));
  }
  return m;
}

/** Metadata for the Mortgage liability that is auto-created / kept in sync with a property. */
export function buildLinkedMortgageMeta(propName: string, f: Partial<PayFields>) {
  const m: Record<string, any> = { linkedAssetName: propName };
  const pay = num(f.mortgageMonthlyPayment);
  if (pay > 0) {
    m.payment = String(pay);
    m.paymentFrequency = f.mortgageFreq || "monthly";
    m.monthlyPayment = String(r2(toMonthly(pay, f.mortgageFreq)));
  }
  if (f.taxFreq === "with_mortgage") m.taxIncluded = true;
  return m;
}

/** True when `loan` is the Car Loan linked to this vehicle (by id; by name for loans made before ids were stored). */
export function isLinkedLoan(loan: any, vehicle: { id: number; name: string }): boolean {
  if (!loan || loan.type !== "liability" || loan.category !== "Car Loan") return false;
  const m = loan.metadata ?? {};
  return m.linkedAssetId != null ? Number(m.linkedAssetId) === Number(vehicle.id) : m.linkedAssetName === vehicle.name;
}

/** Small read-only chips shown under an entry's name. */
export function payChips(category: string, m: any, value?: any): { key: string; text: string }[] {
  m = m ?? {};
  const chips: { key: string; text: string }[] = [];
  if ((category === "Mortgage" || category === "Car Loan") && num(m.payment) > 0) {
    chips.push({ key: "pay", text: `${money(num(m.payment))} ${freqShort(m.paymentFrequency)}` });
  }
  if (category === "Credit Card") {
    if (num(m.creditLimit) > 0) {
      chips.push({ key: "lim", text: `Limit ${money(num(m.creditLimit))}` });
      if (num(value) > 0) chips.push({ key: "util", text: `${Math.round((num(value) / num(m.creditLimit)) * 100)}% used` });
    }
    if (m.interestRate != null && m.interestRate !== "") chips.push({ key: "rate", text: `${num(m.interestRate)}%` });
    if (num(m.payment) > 0) chips.push({ key: "pay", text: `${money(num(m.payment))} ${freqShort(m.paymentFrequency)}` });
  }
  if (category === "Car Loan") {
    if (num(m.vehicleValue) > 0) chips.push({ key: "veh", text: `Vehicle ${money(num(m.vehicleValue))}` });
    if (m.interestRate != null && m.interestRate !== "") chips.push({ key: "rate", text: `${num(m.interestRate)}%` });
    if (num(m.termMonths) > 0)
      chips.push({
        key: "term",
        text:
          m.termLeftMonths != null && m.termLeftMonths !== ""
            ? `${num(m.termLeftMonths)} of ${num(m.termMonths)} mo left`
            : `${num(m.termMonths)} mo term`,
      });
  }
  if (isPropertyCat(category)) {
    if (m.propertyTax?.frequency === "with_mortgage") chips.push({ key: "tax", text: "Tax in mortgage" });
    else if (num(m.annualPropertyTax) > 0) chips.push({ key: "tax", text: `Tax ${money(num(m.annualPropertyTax))}/yr` });
  }
  return chips;
}

// ── Form fields ──────────────────────────────────────────────────────────────

const LBL = "text-xs text-slate-400";
const FIELD =
  "border border-slate-200 bg-white text-slate-800 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-cyan-400";

function Num({
  value,
  onChange,
  testId,
  className = "w-28",
  disabled,
  placeholder = "0",
}: {
  value: any;
  onChange: (v: string) => void;
  testId?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      value={value ?? ""}
      disabled={disabled}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD} ${className} ${disabled ? "bg-slate-50 text-slate-400" : ""}`}
    />
  );
}

function FreqSelect({
  value,
  onChange,
  testId,
}: {
  value: any;
  onChange: (v: string) => void;
  testId?: string;
}) {
  return (
    <select
      value={value || "monthly"}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value)}
      className={FIELD}
    >
      {PAY_FREQS.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

/**
 * Renders the extra inputs for: Principal Residence / Real Estate (other) (mortgage payment,
 * frequency, property tax), Mortgage liabilities (payment + frequency) and Car Loans.
 * `f` is a flat object (a draft or the edit form); `set` writes one key back to it.
 * Returns null for any other category.
 */
export function PaymentFields({
  category,
  f,
  set,
}: {
  category: string;
  f: Record<string, any>;
  set: (k: keyof PayFields, v: string) => void;
}) {
  if (isPropertyCat(category)) {
    const pay = num(f.mortgageMonthlyPayment);
    return (
      <>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Mortgage balance ($):</span>
          <Num
            value={f.mortgageBalance}
            onChange={(v) => set("mortgageBalance", v)}
            testId="input-mortgage-balance"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={LBL}>Mortgage payment ($):</span>
          <Num
            value={f.mortgageMonthlyPayment}
            onChange={(v) => set("mortgageMonthlyPayment", v)}
            testId="input-mortgage-payment"
          />
          <FreqSelect
            value={f.mortgageFreq}
            onChange={(v) => set("mortgageFreq", v)}
            testId="select-mortgage-freq"
          />
          {pay > 0 && f.mortgageFreq && f.mortgageFreq !== "monthly" && (
            <span className="text-[10px] text-slate-400 italic" data-testid="text-mortgage-monthly-eq">
              ≈ {money(r2(toMonthly(pay, f.mortgageFreq)))}/month
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={LBL}>Property tax ($):</span>
          <Num
            value={f.taxFreq === "with_mortgage" ? "" : f.taxAmount}
            onChange={(v) => set("taxAmount", v)}
            disabled={f.taxFreq === "with_mortgage"}
            testId="input-property-tax"
          />
          <select
            value={f.taxFreq || "annual"}
            data-testid="select-property-tax-freq"
            onChange={(e) => set("taxFreq", e.target.value)}
            className={FIELD}
          >
            {TAX_FREQS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
          {f.taxFreq !== "with_mortgage" && num(f.taxAmount) > 0 && f.taxFreq !== "annual" && (
            <span className="text-[10px] text-slate-400 italic" data-testid="text-tax-annual-eq">
              ≈ {money(r2(annualTax(num(f.taxAmount), f.taxFreq)))}/year
            </span>
          )}
        </div>
      </>
    );
  }

  if (category === "Mortgage") {
    const pay = num(f.mortgageMonthlyPayment);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={LBL}>Payment ($):</span>
        <Num
          value={f.mortgageMonthlyPayment}
          onChange={(v) => set("mortgageMonthlyPayment", v)}
          testId="input-mortgage-payment"
        />
        <FreqSelect
          value={f.mortgageFreq}
          onChange={(v) => set("mortgageFreq", v)}
          testId="select-mortgage-freq"
        />
        {pay > 0 && f.mortgageFreq && f.mortgageFreq !== "monthly" && (
          <span className="text-[10px] text-slate-400 italic" data-testid="text-mortgage-monthly-eq">
            ≈ {money(r2(toMonthly(pay, f.mortgageFreq)))}/month
          </span>
        )}
      </div>
    );
  }

  if (category === "Car Loan") {
    const pay = num(f.loanPayment);
    const principal = num(f.financeAmount) || num(f.value);
    const est = estimatePayment(principal, num(f.interestRate), num(f.termMonths), f.loanFreq);
    const termBad = num(f.termMonths) > 0 && num(f.termLeftMonths) > num(f.termMonths);
    return (
      <>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Vehicle value ($):</span>
          <Num value={f.vehicleValue} onChange={(v) => set("vehicleValue", v)} testId="input-vehicle-value" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Finance amount ($):</span>
          <Num value={f.financeAmount} onChange={(v) => set("financeAmount", v)} testId="input-finance-amount" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Interest rate (%):</span>
          <Num
            value={f.interestRate}
            onChange={(v) => set("interestRate", v)}
            testId="input-loan-rate"
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Term (months):</span>
          <Num value={f.termMonths} onChange={(v) => set("termMonths", v)} testId="input-loan-term" className="w-20" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Term left (months):</span>
          <Num
            value={f.termLeftMonths}
            onChange={(v) => set("termLeftMonths", v)}
            testId="input-loan-term-left"
            className="w-20"
          />
          {termBad && (
            <span className="text-[10px] text-red-500" data-testid="text-term-left-warning">
              can't exceed the term
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={LBL}>Payment ($):</span>
          <Num value={f.loanPayment} onChange={(v) => set("loanPayment", v)} testId="input-loan-payment" />
          <FreqSelect value={f.loanFreq} onChange={(v) => set("loanFreq", v)} testId="select-loan-freq" />
          {pay > 0 && f.loanFreq && f.loanFreq !== "monthly" && (
            <span className="text-[10px] text-slate-400 italic" data-testid="text-loan-monthly-eq">
              ≈ {money(r2(toMonthly(pay, f.loanFreq)))}/month
            </span>
          )}
          {est != null && Math.abs(est - pay) > 0.005 && (
            <button
              type="button"
              data-testid="button-use-estimate"
              onClick={() => set("loanPayment", String(r2(est)))}
              className="text-[10px] text-cyan-600 hover:underline"
            >
              Estimated {money(r2(est))} {freqShort(f.loanFreq)} — use
            </button>
          )}
        </div>
      </>
    );
  }

  if (category === "Vehicle") {
    const pay = num(f.loanPayment);
    const est = estimatePayment(num(f.vehicleBalance), num(f.interestRate), num(f.termMonths), f.loanFreq);
    const termBad = num(f.termMonths) > 0 && num(f.termLeftMonths) > num(f.termMonths);
    return (
      <>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Balance owing ($):</span>
          <Num value={f.vehicleBalance} onChange={(v) => set("vehicleBalance", v)} testId="input-vehicle-balance" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Interest rate (%):</span>
          <Num value={f.interestRate} onChange={(v) => set("interestRate", v)} testId="input-vehicle-rate" className="w-20" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Term (months):</span>
          <Num value={f.termMonths} onChange={(v) => set("termMonths", v)} testId="input-vehicle-term" className="w-20" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Term left (months):</span>
          <Num value={f.termLeftMonths} onChange={(v) => set("termLeftMonths", v)} testId="input-vehicle-term-left" className="w-20" />
          {termBad && (
            <span className="text-[10px] text-red-500" data-testid="text-vehicle-term-warning">
              can't exceed the term
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={LBL}>Payment ($):</span>
          <Num value={f.loanPayment} onChange={(v) => set("loanPayment", v)} testId="input-vehicle-payment" />
          <FreqSelect value={f.loanFreq} onChange={(v) => set("loanFreq", v)} testId="select-vehicle-freq" />
          {pay > 0 && f.loanFreq && f.loanFreq !== "monthly" && (
            <span className="text-[10px] text-slate-400 italic" data-testid="text-vehicle-monthly-eq">
              ≈ {money(r2(toMonthly(pay, f.loanFreq)))}/month
            </span>
          )}
          {est != null && Math.abs(est - pay) > 0.005 && (
            <button
              type="button"
              data-testid="button-vehicle-use-estimate"
              onClick={() => set("loanPayment", String(r2(est)))}
              className="text-[10px] text-cyan-600 hover:underline"
            >
              Estimated {money(r2(est))} {freqShort(f.loanFreq)} — use
            </button>
          )}
        </div>
      </>
    );
  }

  if (category === "Credit Card") {
    const pay = num(f.ccPayment);
    const util = num(f.ccLimit) > 0 && num(f.value) > 0 ? Math.round((num(f.value) / num(f.ccLimit)) * 100) : null;
    return (
      <>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Credit limit ($):</span>
          <Num value={f.ccLimit} onChange={(v) => set("ccLimit", v)} testId="input-cc-limit" />
          {util != null && (
            <span className="text-[10px] text-slate-400 italic" data-testid="text-cc-utilization">
              {util}% used
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={LBL}>Interest rate (%):</span>
          <Num value={f.ccRate} onChange={(v) => set("ccRate", v)} testId="input-cc-rate" className="w-20" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={LBL}>Payment, if any ($):</span>
          <Num value={f.ccPayment} onChange={(v) => set("ccPayment", v)} testId="input-cc-payment" />
          <FreqSelect value={f.ccFreq} onChange={(v) => set("ccFreq", v)} testId="select-cc-freq" />
          {pay > 0 && f.ccFreq && f.ccFreq !== "monthly" && (
            <span className="text-[10px] text-slate-400 italic" data-testid="text-cc-monthly-eq">
              ≈ {money(r2(toMonthly(pay, f.ccFreq)))}/month
            </span>
          )}
        </div>
      </>
    );
  }

  return null;
}
