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
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/pengumuman", icon: "📢", label: "Pengumuman" },
    { href: "/admin/ujian", icon: "📋", label: "Ujian" },
    { href: "/admin/setup", icon: "🛠️", label: "Setup Awal" },
  ],
  KEPSEK: [
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/rekap-presensi", icon: "📅", label: "Presensi" },
    { href: "/nilai", icon: "📊", label: "Rekap Nilai" },
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/mpi", icon: "🎮", label: "MPI" },
  ],
  GURU: [
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/presensi", icon: "✅", label: "Presensi" },
    { href: "/tp", icon: "🎯", label: "TP" },
    { href: "/materi", icon: "📖", label: "Materi" },
    { href: "/tugas", icon: "📝", label: "Tugas" },
    { href: "/nilai", icon: "📊", label: "Nilai" },
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/mpi", icon: "🎮", label: "MPI" },
    { href: "/ujian", icon: "📋", label: "Ujian" },
  ],
  SISWA: [
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/materi", icon: "📖", label: "Materi" },
    { href: "/tugas", icon: "📝", label: "Tugas" },
    { href: "/nilai", icon: "📊", label: "Nilai" },
    { href: "/jadwal", icon: "🗓️", label: "Jadwal" },
    { href: "/ujian", icon: "📋", label: "Ujian" },
  ],
  ORTU: [
    { href: "/dashboard", icon: "🏠", label: "Beranda" },
    { href: "/rekap-presensi", icon: "📅", label: "Kehadiran" },
    { href: "/materi", icon: "📖", label: "Materi" },
    { href: "/nilai", icon: "📊", label: "Nilai" },
    { href: "/ujian", icon: "📋", label: "Ujian" },
  ],
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}
