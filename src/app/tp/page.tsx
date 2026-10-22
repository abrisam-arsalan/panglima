import { requireRole } from "@/lib/auth";
import { teacherAssignments } from "@/lib/academic";
import AppShell from "@/components/app-shell";

export default async function TpListPage() {
  const user = await requireRole(["GURU", "ADMIN"]);
  const assigns = await teacherAssignments(user.id);

  return (
    <AppShell user={user} active="/tp">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <span className="current">Tujuan Pembelajaran</span>
      </div>
      <div className="page-head">
        <h1>Tujuan Pembelajaran</h1>
        <p className="muted">Susun TP per mapel. Kode mis. TP.1.</p>
      </div>
      {assigns.length === 0 && (
        <div className="empty">Belum ada kelas mengajar yang terdaftar untuk Anda pada semester ini.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {assigns.map((a) => (
          <a className="card" key={String(a.id)} href={`/tp/${a.id}`} style={{ textDecoration: "none", margin: 0 }}>
            <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 200px" }}>
                <h2 style={{ fontSize: 17, marginBottom: 4 }}>{a.class.name} · {a.subject.name}</h2>
                <span className="muted">Guru Pengampu: {a.teacher?.nama ?? "—"}</span>
              </div>
              <span className="btn btn-sm btn-primary btn-block-mobile" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
                Kelola TP →
              </span>
            </div>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
