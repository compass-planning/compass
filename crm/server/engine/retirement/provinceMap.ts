const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  ontario: "ON",
  on: "ON",
  "british columbia": "BC",
  bc: "BC",
  alberta: "AB",
  ab: "AB",
  quebec: "QC",
  qc: "QC",
  manitoba: "MB",
  mb: "MB",
  saskatchewan: "SK",
  sk: "SK",
  "nova scotia": "NS",
  ns: "NS",
  "new brunswick": "NB",
  nb: "NB",
  "prince edward island": "PE",
  pe: "PE",
  pei: "PE",
  "newfoundland and labrador": "NL",
  nl: "NL",
  "northwest territories": "NT",
  nt: "NT",
  yukon: "YT",
  yt: "YT",
  nunavut: "NU",
  nu: "NU",
};

export function resolveProvinceCode(input: string): string {
  const normalized = input.trim().toLowerCase();
  return PROVINCE_NAME_TO_CODE[normalized] ?? input.toUpperCase();
}
