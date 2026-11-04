import type { CarrierFileType } from "@shared/schema";

export interface CarrierCredentialInfo {
  credentialType: string;
  credentials: string;
}

export interface CarrierClientInfo {
  clientId: number;
  firstName: string;
  lastName: string;
}

export interface CarrierProductData {
  policyNumber: string;
  value: string;
  status: string;
}

export interface CarrierFileResult {
  fileType: CarrierFileType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  content: string;
  productData?: CarrierProductData;
}

export interface CarrierRequestResult {
  status: "completed" | "failed" | "partial";
  files: CarrierFileResult[];
  errorMessage?: string;
}

export interface CarrierRequestStatusResult {
  status: "pending" | "processing" | "completed" | "failed" | "partial";
  errorMessage?: string;
}

export interface ICarrierAdapter {
  getAvailableFileTypes(): CarrierFileType[];
  requestFiles(
    credentials: CarrierCredentialInfo | null,
    clientInfo: CarrierClientInfo,
    fileTypes: CarrierFileType[],
  ): Promise<CarrierRequestResult>;
  getRequestStatus(requestId: string): Promise<CarrierRequestStatusResult>;
}

const FILE_TYPE_LABELS: Record<CarrierFileType, string> = {
  policy_statement: "PolicyStatement",
  tax_slip: "TaxSlip_T4",
  account_summary: "AccountSummary",
  transaction_history: "TransactionHistory",
  confirmation_of_coverage: "ConfirmationOfCoverage",
  beneficiary_summary: "BeneficiarySummary",
};

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "");
}

function stableId(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return 100000 + Math.abs(hash % 900000);
}

interface DemoContentResult {
  content: string;
  productData?: CarrierProductData;
}

function generateDemoContent(
  carrierName: string,
  fileType: CarrierFileType,
  clientName: string,
): DemoContentResult {
  const year = new Date().getFullYear();
  const date = new Date().toLocaleDateString("en-CA");
  const lines: string[] = [];
  let productData: CarrierProductData | undefined;

  if (fileType !== "transaction_history") {
    lines.push(`${carrierName} — ${FILE_TYPE_LABELS[fileType]}`);
    lines.push(`Client: ${clientName}`);
    lines.push(`Date Generated: ${date}`);
    lines.push(`Year: ${year}`);
    lines.push("");
  }

  switch (fileType) {
    case "policy_statement": {
      const policyNum =
        "POL-" + stableId(`${carrierName}:${clientName}:policy`);
      lines.push("POLICY STATEMENT");
      lines.push("Policy Number: " + policyNum);
      lines.push("Coverage Type: Universal Life");
      lines.push("Face Amount: $500,000.00");
      lines.push("Premium: $325.00/month");
      lines.push("Status: Active — In Good Standing");
      lines.push("Effective Date: 2022-01-15");
      lines.push("Next Review Date: " + (year + 1) + "-01-15");
      productData = {
        policyNumber: policyNum,
        value: "500000.00",
        status: "active",
      };
      break;
    }
    case "tax_slip":
      lines.push("TAX INFORMATION SLIP — T4/T5/RL");
      lines.push("Box 14 — Employment Income: $0.00");
      lines.push("Box 16 — Employee CPP Contributions: $0.00");
      lines.push("Investment Income (T5): $2,345.67");
      lines.push("RRSP Contributions: $6,000.00");
      lines.push("Tax Year: " + (year - 1));
      break;
    case "account_summary": {
      const accountNum =
        "ACC-" + stableId(`${carrierName}:${clientName}:account`);
      lines.push("ACCOUNT SUMMARY");
      lines.push("Account Number: " + accountNum);
      lines.push("Account Type: RRSP");
      lines.push("Market Value: $145,230.45");
      lines.push("Book Value: $120,000.00");
      lines.push("Unrealized Gain: $25,230.45");
      lines.push("YTD Return: 8.2%");
      productData = {
        policyNumber: accountNum,
        value: "145230.45",
        status: "active",
      };
      break;
    }
    case "transaction_history":
      lines.push("Date,Type,Description,Amount,Balance");
      lines.push(
        `${year}-01-15,Contribution,Monthly RRSP Deposit,$500.00,$140,730.45`,
      );
      lines.push(
        `${year}-02-15,Contribution,Monthly RRSP Deposit,$500.00,$141,230.45`,
      );
      lines.push(
        `${year}-03-01,Dividend,Q1 Distribution,$1,245.00,$142,475.45`,
      );
      lines.push(
        `${year}-03-15,Contribution,Monthly RRSP Deposit,$500.00,$142,975.45`,
      );
      break;
    case "confirmation_of_coverage": {
      const covPolicyNum =
        "COV-" + stableId(`${carrierName}:${clientName}:coverage`);
      lines.push("CONFIRMATION OF COVERAGE");
      lines.push("Insured: " + clientName);
      lines.push("Life Insurance: $500,000 — Universal Life");
      lines.push("Critical Illness: $100,000 — 25 Conditions");
      lines.push("Disability: $5,000/month — Own Occupation");
      lines.push("All coverages confirmed active as of " + date);
      productData = {
        policyNumber: covPolicyNum,
        value: "500000.00",
        status: "active",
      };
      break;
    }
    case "beneficiary_summary":
      lines.push("BENEFICIARY SUMMARY");
      lines.push("Primary Beneficiary: Spouse (100%)");
      lines.push("Contingent Beneficiary: Estate");
      lines.push("Designation: Revocable");
      lines.push("Last Updated: " + (year - 1) + "-06-20");
      break;
  }

  return {
    content: Buffer.from(lines.join("\n")).toString("base64"),
    productData,
  };
}

const DEMO_DELAY_MS = 2000;

class DemoCarrierAdapter implements ICarrierAdapter {
  private delayMs: number;
  private carrierName: string;

  constructor(carrierName = "Demo", delayMs = DEMO_DELAY_MS) {
    this.carrierName = carrierName;
    this.delayMs = delayMs;
  }

  getAvailableFileTypes(): CarrierFileType[] {
    return [
      "policy_statement",
      "tax_slip",
      "account_summary",
      "transaction_history",
      "confirmation_of_coverage",
      "beneficiary_summary",
    ];
  }

  async requestFiles(
    _credentials: CarrierCredentialInfo | null,
    clientInfo: CarrierClientInfo,
    fileTypes: CarrierFileType[],
  ): Promise<CarrierRequestResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    const clientName = `${clientInfo.firstName} ${clientInfo.lastName}`;
    const sanitizedCarrier = sanitizeName(this.carrierName);
    const sanitizedClient = sanitizeName(clientName);
    const year = new Date().getFullYear();

    const files: CarrierFileResult[] = fileTypes.map((ft) => {
      const isCSV = ft === "transaction_history";
      const ext = isCSV ? "csv" : "pdf";
      const mime = isCSV ? "text/csv" : "application/pdf";
      const result = generateDemoContent(this.carrierName, ft, clientName);

      return {
        fileType: ft,
        fileName: `${sanitizedCarrier}_${FILE_TYPE_LABELS[ft]}_${sanitizedClient}_${year}.${ext}`,
        mimeType: mime,
        fileSizeBytes: Buffer.from(result.content, "base64").length,
        content: result.content,
        productData: result.productData,
      };
    });

    return {
      status: "completed",
      files,
    };
  }

  async getRequestStatus(
    _requestId: string,
  ): Promise<CarrierRequestStatusResult> {
    return { status: "completed" };
  }
}

const adapterRegistry = new Map<string, ICarrierAdapter>();

export function getCarrierAdapter(carrierName: string): ICarrierAdapter {
  const adapter = adapterRegistry.get(carrierName.toLowerCase());
  if (adapter) return adapter;
  return new DemoCarrierAdapter(carrierName);
}

export function registerCarrierAdapter(
  carrierName: string,
  adapter: ICarrierAdapter,
): void {
  adapterRegistry.set(carrierName.toLowerCase(), adapter);
}

export function getAvailableFileTypes(carrierName: string): CarrierFileType[] {
  const adapter = getCarrierAdapter(carrierName);
  return adapter.getAvailableFileTypes();
}
