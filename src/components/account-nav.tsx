import Link from "next/link";

export default function AccountNav({ activeTab }: { activeTab: "kelas" | "siswa" | "guru" | "ortu" }) {
  const tabs = [
    { id: "kelas", label: "🏫 Kelas & Rombel", href: "/admin/akun/kelas" },
    { id: "siswa", label: "🎓 Siswa", href: "/admin/akun/siswa" },
    { id: "guru", label: "👨‍🏫 Guru", href: "/admin/akun/guru" },
    { id: "ortu", label: "👨‍👩‍👧 Orang Tua", href: "/admin/akun/ortu" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 20,
        background: "var(--paper, #fff)",
        padding: "8px 12px",
        border: "2px solid var(--ink, #000)",
        borderRadius: "var(--radius-sm, 6px)",
        boxShadow: "3px 3px 0 var(--ink, #000)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`btn btn-sm ${isActive ? "btn-primary" : "btn-neutral"}`}
            style={{
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
