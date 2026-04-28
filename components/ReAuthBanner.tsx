"use client";

interface ReAuthBannerProps {
  show: boolean;
}

export function ReAuthBanner({ show }: ReAuthBannerProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-900">
      Offline &mdash; re-authentication required when back online.
    </div>
  );
}
