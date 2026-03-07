const SITE_CODE_PREFIX = "PMIS-SITE-";
const SITE_CODE_MIN_DIGITS = 3;
const SITE_CODE_PATTERNS = [/^PMIS-SITE-(\d+)$/i, /^SITE-(\d+)$/i];

function extractSiteCodeSequence(siteCode: string): number | null {
  const normalized = siteCode.trim().toUpperCase();

  for (const pattern of SITE_CODE_PATTERNS) {
    const match = pattern.exec(normalized);
    if (!match) {
      continue;
    }

    const sequence = Number(match[1]);
    if (Number.isFinite(sequence) && sequence >= 0) {
      return sequence;
    }
  }

  return null;
}

export function getNextSiteCode(siteCodes: readonly string[]): string {
  let maxSequence = 0;

  for (const siteCode of siteCodes) {
    const sequence = extractSiteCodeSequence(siteCode);
    if (sequence !== null && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }

  const nextSequence = maxSequence + 1;
  const width = Math.max(SITE_CODE_MIN_DIGITS, String(nextSequence).length);
  return `${SITE_CODE_PREFIX}${String(nextSequence).padStart(width, "0")}`;
}
