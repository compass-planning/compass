import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Plus, Printer, Trash2, FileText, Save, ChevronDown } from "lucide-react";

interface Letter {
  id: number;
  letterType: string;
  subject: string;
  body: string;
  createdAt: string;
}

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  province?: string | null;
}

const LETTER_TYPES = [
  { key: "rw01", label: "RW-01 Fully Implemented" },
  { key: "rw02", label: "RW-02 Partially Implemented" },
  { key: "rw03", label: "RW-03 No Implementation" },
  { key: "rw04", label: "RW-04 MADPUA — Cash Value & Death Benefit" },
  { key: "rw05", label: "RW-05 CTBR — High Cash Value" },
  { key: "rw06", label: "RW-06 Term Conversion with MADPUA" },
  { key: "rw07", label: "RW-07 Term Life Insurance" },
  { key: "rw08", label: "RW-08 Long-Term Care Insurance" },
  { key: "rw10", label: "RW-10 Disability Income Insurance" },
  { key: "rw11", label: "RW-11 Annuity" },
  { key: "rw12", label: "RW-12 Settlement Options" },
];

const TEMPLATES: Record<string, (clientName: string, date: string) => string> = {
  rw01: (n, d) => `${d}

Hello ${n},

Thank you for taking the time to meet with me to discuss your financial security and the well-being of your loved ones. I am pleased to confirm that you have taken a significant step toward securing your family's future by implementing the insurance coverage we discussed.

When we met, I recommended that you purchase a <<TYPE OF POLICY>> insurance policy with a face amount of <<FACE AMOUNT>>, issued by the Compass Planning.

You shared with me that <<CLIENT CIRCUMSTANCES — e.g., you are focused on ensuring your family is financially protected, particularly given the recent birth of your second child and your new mortgage>>.

This policy meets your insurance needs by <<HOW PRODUCT MEETS NEEDS — e.g., providing comprehensive coverage at a competitive rate, ensuring that your mortgage would be paid off in the event of an unforeseen tragedy, providing your family with the stability they need>>.

Your new insurance policy will be mailed to you. Please read it over once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-01`,

  rw02: (n, d) => `${d}

Hello ${n},

Thank you for meeting with me to discuss your financial future and for taking steps to ensure your loved ones are protected. I am pleased to confirm that you have taken a significant step toward securing your family's future by implementing some of the insurance coverage we discussed.

We discussed two products: a <<POLICY A TYPE>> and a <<POLICY B TYPE>>. You have chosen to proceed with the <<POLICY A TYPE>> with a face amount of <<FACE AMOUNT>>, issued by the Compass Planning.

This decision aligns with your current circumstances, particularly since <<CLIENT CIRCUMSTANCES AND REASON — e.g., your primary concern is building an inheritance for your children in a tax-efficient manner, while also securing additional coverage for unforeseen circumstances>>.

You decided to defer the <<POLICY B TYPE>> for now, as <<REASON FOR DEFERRAL — e.g., it may not be an immediate priority given your current budget>>. We have agreed to revisit this option <<FOLLOW-UP TIMELINE — e.g., at our next annual review in [month/year]>>.

Your new insurance policy will be mailed to you. Please read it over once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-02`,

  rw03: (n, d) => `${d}

Hello ${n},

Thank you for taking the time to meet with me to discuss your financial security and the well-being of your loved ones. While we reviewed the options available to help secure your family's future, I understand that you have decided not to proceed with an insurance plan at this time.

During our conversation, we discussed <<WHAT WAS DISCUSSED — e.g., the importance of protecting your family from financial hardships in the event of an unforeseen tragedy, and specifically your need for income replacement and mortgage coverage>>.

Without coverage in place, your loved ones may be left without the financial resources needed to maintain their current lifestyle, cover ongoing expenses, or achieve future goals.

I want to reassure you that should your circumstances change or should you reconsider your decision, I would be happy to revisit these options with you. Life insurance provides peace of mind, knowing that your family will be financially protected.

Please feel free to reach out if you have any questions or wish to explore coverage again in the future.

If any of this information about you or your needs is not correct, please let me know right away. You may reach me at the number or email below at any time.

Please keep this letter with your personal papers as a record of our discussion.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-03`,

  rw04: (n, d) => `${d}

Hello ${n},

Thank you for taking the steps to enhance your financial security by implementing the insurance strategy we discussed. I am pleased to confirm that you have chosen to include the Modified Additional Deposit Paid-Up Additions (MADPUA) rider in your policy.

When we met, you decided to purchase a <<TYPE OF POLICY>> insurance policy with a face amount of <<FACE AMOUNT>>, issued by the Compass Planning.

You shared with me that <<CLIENT CIRCUMSTANCES — e.g., you are focused on ensuring your family is financially protected, particularly given the recent birth of your second child and your new mortgage>>.

This policy meets your insurance needs by <<HOW PRODUCT MEETS NEEDS — e.g., providing comprehensive coverage at a competitive rate while also accelerating the growth of your policy's cash value>>.

By utilizing the MADPUA rider, you are accelerating your policy's cash value growth, providing potential access to funds for living benefits. This allows for future flexibility in case of unforeseen needs while also ensuring that your death benefit continues to grow over time.

Important Information

Dividends: While dividends play a crucial role in the performance of your policy, they are not guaranteed. The Compass Planning is a direct recognition company, which means that any outstanding policy loans will affect how dividends are credited to your policy.

Policy Loans: Loans taken against your policy up to the adjusted cost basis (ACB) are generally received on a tax-free basis under current tax rules. However, exceeding the ACB or allowing the policy to lapse while a loan is outstanding may trigger a taxable event. Repaying policy loans in a timely manner helps maintain your coverage, avoids potential tax consequences, and ensures funds remain available in the future.

Your new insurance policy will be mailed to you. Please review it carefully once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-04`,

  rw05: (n, d) => `${d}

Hello ${n},

Thank you for working together to implement a strategy that aligns with your financial goals. I am pleased to confirm that you have chosen to incorporate the High Cash Value Custom Term Blend Rider (CTBR), which is designed to maximize early cash value growth while maintaining long-term flexibility.

When we met, you decided to purchase a <<TYPE OF POLICY>> insurance policy with a face amount of <<FACE AMOUNT>>, issued by the Compass Planning.

You shared with me that <<CLIENT CIRCUMSTANCES — e.g., you are looking to build accessible cash value quickly while maintaining long-term insurance protection for your family>>.

This policy meets your needs by <<HOW PRODUCT MEETS NEEDS — e.g., allowing you to quickly build cash value, enabling you to utilize funds when necessary while keeping your insurance coverage intact>>.

Important Information

Dividends: Dividends are not guaranteed. The Compass Planning is a direct recognition company, which means that any outstanding policy loans will affect how dividends are credited to your policy. Repaying loans in a timely manner will help optimize your policy's performance.

Policy Loans: Loans taken against your policy up to the adjusted cost basis (ACB) are generally received on a tax-free basis under current tax rules. However, exceeding the ACB or allowing the policy to lapse while a loan is outstanding may trigger a taxable event. Repaying policy loans helps maintain your death benefit and avoids potential tax consequences.

By structuring your policy this way, you have positioned yourself to take advantage of future opportunities while keeping your insurance coverage intact.

Your new insurance policy will be mailed to you. Please review it carefully once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-05`,

  rw06: (n, d) => `${d}

Hello ${n},

Congratulations on taking the important step of converting your term insurance into permanent coverage. This decision ensures that your coverage will remain in place for the long term without the concern of term expiration.

When we met, you decided to convert to a <<TYPE OF POLICY>> insurance policy with a face amount of <<FACE AMOUNT>>, issued by the Compass Planning.

You shared with me that <<CLIENT CIRCUMSTANCES — e.g., your term policy is approaching its renewal period and the premium increase would be significant, so permanent coverage provides stability and long-term value>>.

This policy meets your needs by <<HOW PRODUCT MEETS NEEDS — e.g., providing lifelong coverage at a level premium while also building cash value through the MADPUA rider>>.

By incorporating the MADPUA rider, you have taken an additional step to strengthen your policy by enhancing its cash value accumulation. It is important to note that this approach may result in a temporary reduction in your death benefit as funds are allocated toward building policy cash value. Over time, this strategy is designed to restore and potentially exceed the original benefit amount.

Important Information

Dividends: Dividends are not guaranteed. The Compass Planning is a direct recognition company, which means that any outstanding policy loans will affect how dividends are credited to your policy.

Policy Loans: Loans taken against your policy up to the adjusted cost basis (ACB) are generally received on a tax-free basis under current tax rules. However, exceeding the ACB or allowing the policy to lapse while a loan is outstanding may trigger a taxable event. Repaying policy loans helps maintain your coverage and avoids potential tax consequences.

Your new insurance policy will be mailed to you. Please review it carefully once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-06`,

  rw07: (n, d) => `${d}

Hello ${n},

Thank you for taking the time to meet with me to discuss your financial security. I am pleased to confirm that you have taken a significant step toward protecting your family by implementing the term life insurance coverage we discussed.

I recommended a <<TERM LENGTH — e.g., 20-year>> renewable term life insurance policy with a face amount of <<FACE AMOUNT>>, issued by the Compass Planning.

When we met, you shared that <<CLIENT CIRCUMSTANCES — e.g., you and your spouse are both young and healthy, you recently purchased a home with a 25-year mortgage, and you wanted an affordable option to ensure the mortgage is covered if something happens to you>>.

This policy meets your needs by <<HOW PRODUCT MEETS NEEDS — e.g., providing $500,000 in coverage that aligns with your mortgage balance, at a premium that fits your current budget. The 20-year term corresponds to the bulk of your mortgage amortization period>>.

<<IF APPLICABLE — e.g., We also discussed your conversion privilege, which allows you to convert this term policy to permanent coverage in the future without additional medical underwriting. This gives you flexibility as your circumstances change.>>

<<IF COVERAGE IS LESS THAN NEED — e.g., Based on our needs analysis, the full income replacement need identified was $750,000. Based on your current budget, you chose to proceed with $500,000, which partially meets the identified need. We have agreed to revisit the remaining $250,000 gap at our next annual review.>>

Your new insurance policy will be mailed to you. Please read it over once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-07`,

  rw08: (n, d) => `${d}

Hello ${n},

Thank you for meeting with me to discuss your long-term care planning. I am pleased to confirm that you have taken an important step to protect yourself and your family by implementing the long-term care insurance coverage we discussed.

I recommended a Long-Term Care insurance policy issued by the Compass Planning with a <<DAILY/MONTHLY BENEFIT AMOUNT>> benefit, a <<BENEFIT PERIOD — e.g., 3-year, 5-year, lifetime>> benefit period, and a <<ELIMINATION PERIOD — e.g., 90-day>> elimination period.

When we met, you shared that <<CLIENT CIRCUMSTANCES — e.g., you are approaching retirement and want to ensure that if you require extended care, the cost does not deplete your retirement savings or become a burden on your children>>.

This policy meets your needs by <<HOW PRODUCT MEETS NEEDS — e.g., providing coverage for long-term care expenses in a nursing home, assisted living facility, or in your own home, so that your retirement savings and estate remain intact for your spouse and family>>.

<<IF INFLATION PROTECTION SELECTED — e.g., You also selected the inflation protection rider, which will increase your benefit amount over time to help keep pace with the rising cost of care.>>

<<IF REDUCED BENEFIT — e.g., Based on our analysis, a higher daily benefit of $250 would more closely match current care costs in your area. You chose to proceed with $200/day to keep the premium affordable. We have agreed to revisit this at your next annual review.>>

Your new insurance policy will be mailed to you. Please review it carefully once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-08`,

  rw10: (n, d) => `${d}

Hello ${n},

Thank you for meeting with me to discuss the protection of your most important financial asset — your ability to earn an income. I am pleased to confirm that you have taken an important step by implementing the disability income insurance we discussed.

I recommended a Disability Income insurance policy issued by the Compass Planning with a monthly benefit of <<MONTHLY BENEFIT AMOUNT>>, a <<WAITING PERIOD — e.g., 90-day>> waiting period, and a <<BENEFIT PERIOD — e.g., to age 65, 5-year>> benefit period.

When we met, you shared that <<CLIENT CIRCUMSTANCES — e.g., you are the primary income earner for your family with a gross annual income of approximately $85,000. You are concerned that a prolonged illness or injury could prevent you from working and meeting your family's financial obligations>>.

This policy meets your needs by <<HOW PRODUCT MEETS NEEDS — e.g., replacing approximately 60% of your gross income if you are unable to work due to a covered disability, allowing you to continue meeting your mortgage payments, living expenses, and other financial commitments>>.

The policy uses a <<DEFINITION OF DISABILITY — e.g., 'own occupation' definition for the first 2 years and 'any occupation' thereafter>> definition of disability. This means <<EXPLAIN WHAT THIS MEANS IN PLAIN LANGUAGE>>.

<<IF RIDERS SELECTED — e.g., You also selected the Cost of Living Adjustment rider, which will increase your monthly benefit during a claim to help keep pace with inflation, and the Future Insurability Option, which allows you to increase coverage in the future without additional medical underwriting.>>

Your new insurance policy will be mailed to you. Please review it carefully once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your policy, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-10`,

  rw11: (n, d) => `${d}

Hello ${n},

Thank you for meeting with me to discuss your retirement income planning. I am pleased to confirm that you have taken an important step toward securing your financial future by implementing the annuity we discussed.

You decided to purchase a <<TYPE OF ANNUITY — e.g., Single Premium Deferred Annuity, Flexible Premium Annuity>> with the Compass Planning, with a <<PREMIUM/DEPOSIT AMOUNT>>.

When we met, you shared that <<CLIENT CIRCUMSTANCES — e.g., you are nearing retirement and want to ensure you have a guaranteed income stream that you cannot outlive, supplementing your pension and government benefits>>.

This annuity meets your needs by <<HOW PRODUCT MEETS NEEDS — e.g., providing a guaranteed interest rate on your deposit, with the flexibility to begin income payments at a future date of your choosing, ensuring a stable and predictable income in retirement>>.

Important Information

<<INTEREST RATE/CREDITING — e.g., Your annuity currently offers a guaranteed minimum interest rate of X%, with the potential for a higher credited rate based on the Order's financial performance.>>

<<SURRENDER/WITHDRAWAL — e.g., Please be aware that early withdrawals within the first [X] years may be subject to a surrender charge. We discussed the surrender schedule in detail and you indicated that you do not anticipate needing these funds within that period.>>

<<TAX TREATMENT IF DISCUSSED — e.g., As we discussed, annuity payments include both a return of your principal and interest income. The interest portion is subject to income tax when received. Please consult your tax advisor for guidance specific to your situation.>>

Your annuity contract will be mailed to you. Please review it carefully once you receive it.

If any of this information about you or your needs is not correct, please let me know right away. If you have any questions about your contract, please do not hesitate to contact me at the number or email below.

Please keep this letter with your personal papers as a reminder of why you have this coverage.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-11`,

  rw12: (n, d) => `${d}

Hello ${n},

Thank you for meeting with me during this time. I understand this may be a difficult period, and I am here to help you navigate the decisions regarding the <<DESCRIBE — e.g., life insurance death benefit / matured policy proceeds>> from the policy of <<POLICYHOLDER/DECEASED NAME>>.

The total benefit amount is <<BENEFIT AMOUNT>>. As the <<BENEFICIARY / POLICYHOLDER>>, you have several options for how these funds can be received.

Settlement Options Discussed

<<OPTION 1 — e.g., Lump Sum Payment: Receive the full benefit amount as a single payment. This provides immediate access to the funds but places the responsibility of investment and management with you.>>

<<OPTION 2 — e.g., Interest Only: The benefit amount remains on deposit with the Compass Planning and earns interest. You receive periodic interest payments while preserving the principal for future use or distribution.>>

<<OPTION 3 — e.g., Fixed Period Income: The benefit is paid out in equal installments over a fixed number of years, providing a regular income stream for a defined period.>>

<<OPTION 4 — e.g., Life Income: The benefit is converted into a guaranteed income stream for your lifetime, ensuring you cannot outlive the proceeds.>>

After reviewing these options, you chose to proceed with <<CHOSEN SETTLEMENT OPTION>> because <<REASON — e.g., you prefer the security of a guaranteed income for life to supplement your retirement income>>.

<<TAX IMPLICATIONS IF DISCUSSED — e.g., As we discussed, life insurance death benefits are generally received income tax-free by the beneficiary. However, any interest earned on retained funds may be subject to income tax. Please consult your tax advisor for guidance specific to your situation.>>

I want to assure you that I am here to support you through this process. Please do not hesitate to reach out with any questions.

If any of this information about you or your needs is not correct, please let me know right away. You may reach me at the number or email below at any time.

Please keep this letter with your personal papers as a record of our discussion and the option you selected.

Thank you,

<<AGENT FULL NAME>>
Compass Planning

<<AGENT PHONE>>  |  <<AGENT EMAIL>>

Compass Planning  |  Confidential  |  RW-12`,
};

export function LettersTab({ clientId, client }: { clientId: number; client?: Client }) {
  const [letters, setLetters]   = useState<Letter[]>([]);
  const [selected, setSelected] = useState<Letter | null>(null);
  const [busy, setBusy]         = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [newType, setNewType]   = useState("rw01");

  const load = () =>
    api.get<Letter[]>(`/api/clients/${clientId}/letters`).then(setLetters).catch(() => {});

  useEffect(() => { load(); }, [clientId]);

  async function createLetter() {
    if (!client) return;
    setBusy(true);
    try {
      const date = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
      const clientName = `${client.firstName} ${client.lastName}`;
      const templateFn = TEMPLATES[newType];
      const body = templateFn ? templateFn(clientName, date) : "";
      const label = LETTER_TYPES.find(t => t.key === newType)?.label ?? newType;
      const letter = await api.post<Letter>(`/api/clients/${clientId}/letters`, {
        letterType: newType,
        subject: `${label} — ${clientName}`,
        body,
      });
      setLetters(l => [letter, ...l]);
      setSelected(letter);
      setShowNew(false);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function saveLetter() {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await api.patch<Letter>(`/api/letters/${selected.id}`, {
        subject: selected.subject,
        body: selected.body,
      });
      setSelected(updated);
      setLetters(l => l.map(x => x.id === updated.id ? updated : x));
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function deleteLetter(id: number) {
    if (!confirm("Delete this letter?")) return;
    await api.delete(`/api/letters/${id}`);
    setLetters(l => l.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  function printLetter() {
    if (!selected) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const escaped = selected.body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    win.document.write(`<!DOCTYPE html><html><head><title>${selected.subject}</title>
<style>
  body{font-family:"Times New Roman",serif;font-size:12pt;max-width:680px;margin:60px auto;color:#000;line-height:1.7;}
  pre{font-family:"Times New Roman",serif;font-size:12pt;white-space:pre-wrap;line-height:1.7;margin:0;}
  @media print{body{margin:1in;}}
</style></head><body><pre>${escaped}</pre></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  const typeLabel = (key: string) => LETTER_TYPES.find(t => t.key === key)?.label ?? key;

  return (
    <div className="flex h-full min-h-0" style={{ height: "calc(100vh - 64px)" }}>
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 flex flex-col flex-shrink-0 bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Reason Why Letters</h2>
          <button onClick={() => setShowNew(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-3 py-2 rounded-xl">
            <Plus className="w-4 h-4" /> New Letter
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {letters.length === 0 ? (
            <div className="text-center mt-12 px-4">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No letters yet. Create one to get started.</p>
            </div>
          ) : (
            letters.map(l => (
              <button key={l.id} onClick={() => setSelected(l)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors ${selected?.id === l.id ? "bg-white border-l-4 border-l-[#0c1e3a]" : ""}`}>
                <p className="text-xs font-semibold text-gray-800 truncate">{l.subject}</p>
                <p className="text-[10px] text-[#0c1e3a] font-medium mt-0.5">{typeLabel(l.letterType)}</p>
                <p className="text-[10px] text-gray-400">{new Date(l.createdAt).toLocaleDateString("en-CA")}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-[440px]">
              <h3 className="text-lg font-bold text-gray-900 mb-4">New Reason Why Letter</h3>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Letter Type</label>
              <div className="relative mb-5">
                <select value={newType} onChange={e => setNewType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-[#0c1e3a]/20">
                  {LETTER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowNew(false)} className="text-sm text-gray-500 px-4 py-2 hover:bg-gray-50 rounded-xl">Cancel</button>
                <button onClick={createLetter} disabled={busy || !client}
                  className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                  {busy ? "Creating…" : "Create Letter"}
                </button>
              </div>
            </div>
          </div>
        )}

        {selected ? (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[#0c1e3a] bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">{typeLabel(selected.letterType)}</span>
                <input value={selected.subject}
                  onChange={e => setSelected(s => s ? {...s, subject: e.target.value} : s)}
                  className="text-sm font-semibold text-gray-900 border-0 outline-none bg-transparent min-w-0 flex-1"
                  placeholder="Subject line..." />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <button onClick={() => deleteLetter(selected.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={saveLetter} disabled={busy}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {busy ? "Saving…" : "Save"}
                </button>
                <button onClick={printLetter}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-xl">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>
            <div className="flex-1 p-5 overflow-hidden">
              <textarea
                value={selected.body}
                onChange={e => setSelected(s => s ? {...s, body: e.target.value} : s)}
                className="w-full h-full resize-none border border-gray-200 rounded-xl p-4 text-sm font-mono text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0c1e3a]/20"
                spellCheck
                style={{ fontFamily: '"Courier New", monospace', fontSize: '13px' }}
              />
            </div>
            <div className="px-5 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <p className="text-[10px] text-gray-400">Replace all <strong>{"<<PLACEHOLDER>>"}</strong> fields before printing. Agent notes have been removed from this template.</p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-600">Select a letter or create a new one</p>
            <p className="text-xs mt-1 text-gray-400">Templates pre-populate with client name and date</p>
            <p className="text-xs text-gray-400">Replace {"<<PLACEHOLDERS>>"} before printing</p>
          </div>
        )}
      </div>
    </div>
  );
}

