const provinceNameToCode: Record<string, string> = {
  ontario: "ON", british_columbia: "BC", "british columbia": "BC",
  alberta: "AB", quebec: "QC", québec: "QC", saskatchewan: "SK",
  manitoba: "MB", "new brunswick": "NB", new_brunswick: "NB",
  "nova scotia": "NS", nova_scotia: "NS",
  "prince edward island": "PE", prince_edward_island: "PE",
  "newfoundland and labrador": "NL", newfoundland: "NL",
  "northwest territories": "NT", northwest_territories: "NT",
  nunavut: "NU", yukon: "YT",
  on: "ON", bc: "BC", ab: "AB", qc: "QC", sk: "SK", mb: "MB",
  nb: "NB", ns: "NS", pe: "PE", nl: "NL", nt: "NT", nu: "NU", yt: "YT",
};

export function normalizeProvince(input: string): string {
  const normalized = provinceNameToCode[input.toLowerCase().trim()];
  if (normalized) return normalized;
  const upper = input.toUpperCase().trim();
  if (upper.length === 2) return upper;
  return "ON";
}
