import type { Role } from "@prisma/client";

export interface NavChild {
  href: string;
  icon: string;
  label: string;
}

export interface NavItem {
  href: string;
  icon: string;
  label: string;
  children?: NavChild[];
}

export const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    {
      href: "/admin/akun/siswa",
      icon: "👥",
      label: "Akun",
      children: [
        { href: "/admin/akun/kelas", icon: "🏫", label: "Kelas & Rombel" },
        { href: "/admin/akun/siswa", icon: "🎓", label: "Siswa" },
        { href: "/admin/akun/guru", icon: "👨‍🏫", label: "Guru" },
        { href: "/admin/akun/ortu", icon: "👨‍👩‍👧", label: "Orang Tua" },
      ],
    },
    { href: "/admin/penugasan", icon: "📋", label: "Penugasan" },
    { href: "/rekap-presensi", icon: "📅", label: "Rekap Presensi" },
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/pengumuman", icon: "📢", label: "Pengumuman" },
    { href: "/admin/ujian", icon: "📋", label: "Ujian" },
    { href: "/admin/cetak", icon: "🖨️", label: "Cetak Nilai" },
    { href: "/admin/laporan", icon: "💬", label: "Laporan Feedback" },
    { href: "/admin/setup", icon: "🛠️", label: "Setup Awal" },
  ],
  KEPSEK: [
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/rekap-presensi", icon: "📅", label: "Presensi" },
    { href: "/nilai", icon: "📊", label: "Rekap Nilai" },
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/mpi", icon: "🎮", label: "MPI" },
    { href: "/admin/laporan", icon: "💬", label: "Laporan" },
  ],
  // Bottombar: MAKS 5 item — 4 favorit + "Lainnya" (sisa menu di sheet).
  // Urutan = jempol: tengah = aksi harian (Presensi guru / Tugas siswa).
  GURU: [
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/tugas", icon: "📝", label: "Tugas" },
    { href: "/presensi", icon: "📝", label: "Presensi" },
    { href: "/nilai", icon: "📊", label: "Nilai" },
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/tp", icon: "🎯", label: "TP" },
    { href: "/materi", icon: "📖", label: "Materi" },
    { href: "/mpi", icon: "🎮", label: "MPI" },
    { href: "/ujian", icon: "📋", label: "Ujian" },
  ],
  SISWA: [
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/materi", icon: "📖", label: "Materi" },
    { href: "/tugas", icon: "📝", label: "Tugas" },
    { href: "/nilai", icon: "📊", label: "Nilai" },
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/umpan-balik", icon: "💬", label: "Umpan Balik" },
    { href: "/ujian", icon: "📋", label: "Ujian" },
  ],
  ORTU: [
    { href: "/rekap-presensi", icon: "📅", label: "Kehadiran" },
    { href: "/nilai", icon: "📊", label: "Nilai" },
    { href: "/umpan-balik", icon: "💬", label: "Umpan Balik" },
    { href: "/materi", icon: "📖", label: "Materi" },
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/ujian", icon: "📋", label: "Ujian" },
  ],
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}
