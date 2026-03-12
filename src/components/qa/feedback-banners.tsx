type QaFeedbackBannersProps = {
  message?: string | null;
  error?: string | null;
};

export function QaFeedbackBanners({ message, error }: QaFeedbackBannersProps) {
  if (!message && !error) {
    return null;
  }

  return (
    <div className="space-y-2">
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
