export function buildUploadUrl(storagePath?: string | null) {
  const normalized = String(storagePath ?? "").trim().replace(/^\/+/, "");
  return normalized ? `/uploads/${normalized}` : "";
}
