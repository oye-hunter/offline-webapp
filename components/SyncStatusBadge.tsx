"use client";

import { useEffect, useState } from "react";
import { localDB } from "@/lib/db/dexie";
import { useOnlineStatus } from "@/lib/sync/hooks";

export function SyncStatusBadge() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    localDB.notes
      .where("syncStatus")
      .equals("pending")
      .count()
      .then((count) => {
        if (!cancelled) {
          setPendingCount(count);
        }
      })
      .catch(() => {
        // DB read failure is non-fatal; leave count as-is.
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  let label: string;
  let colorClass: string;

  if (!isOnline) {
    label = "Offline";
    colorClass = "bg-gray-700 text-white";
  } else if (pendingCount > 0) {
    label = "Syncing\u2026";
    colorClass = "bg-yellow-400 text-yellow-900";
  } else {
    label = "All synced";
    colorClass = "bg-green-500 text-white";
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 rounded-full px-3 py-1 text-xs font-medium shadow ${colorClass}`}
    >
      {label}
    </div>
  );
}
