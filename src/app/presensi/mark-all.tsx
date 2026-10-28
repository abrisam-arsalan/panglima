"use client";

import { useCallback } from "react";
import type { AttendanceStatus } from "@prisma/client";

const LABEL: Record<AttendanceStatus, string> = {
  HADIR: "✔️ Hadir",
  SAKIT: "🤒 Sakit",
  IZIN: "📄 Izin",
  ALPHA: "❌ Alpa",
};

/** Tombol "tandai semua" — mencentang radio status untuk seluruh siswa dalam form. */
export default function MarkAll({ formId }: { formId: string }) {
  const mark = useCallback(
    (st: AttendanceStatus) => {
      const form = document.getElementById(formId);
      if (!form) return;
      form
        .querySelectorAll<HTMLInputElement>(`input[type="radio"][value="${st}"]`)
        .forEach((r) => {
          r.checked = true;
        });
    },
    [formId]
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: "10px 14px",
        borderBottom: "2px solid var(--border)",
      }}
    >
      {(Object.keys(LABEL) as AttendanceStatus[]).map((st) => (
        <button
          key={st}
          type="button"
          className="btn btn-sm"
          style={{ minHeight: 40 }}
          onClick={() => mark(st)}
        >
          Tandai semua {LABEL[st]}
        </button>
      ))}
    </div>
  );
}
