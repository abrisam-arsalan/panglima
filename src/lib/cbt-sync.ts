import { prisma } from "@/lib/prisma";
import { notifyClass, createNotification } from "@/lib/notify";
import type { User } from "@prisma/client";

export interface CbtExamItem {
  id: bigint;
  title: string;
  description: string | null;
  class_id: bigint | null;
  grade: string | null;
  duration_minutes: number;
  start_at: Date | null;
  end_at: Date | null;
  status: string;
  class_name?: string | null;
}

/**
 * Mengambil daftar ujian aktif/terjadwal dari database cbt_tka yang relevan untuk user (siswa / guru / admin).
 */
export async function getCbtExamsForUser(user: User): Promise<CbtExamItem[]> {
  try {
    const raw = await prisma.$queryRawUnsafe<CbtExamItem[]>(`
      SELECT e.id, e.title, e.description, e.class_id, e.grade, e.duration_minutes, e.start_at, e.end_at, e.status,
             c.name AS class_name
      FROM cbt_tka.exams e
      LEFT JOIN cbt_tka.classes c ON c.id = e.class_id
      WHERE e.status IN ('active', 'published', 'scheduled')
      ORDER BY e.start_at DESC, e.id DESC
    `);

    if (user.role !== "SISWA") {
      return raw;
    }

    // Untuk siswa, filter berdasarkan rombel / jenjang siswa
    const student = await prisma.user.findUnique({
      where: { id: user.id },
      select: { classRef: { select: { name: true, tingkat: true } } },
    });

    const myClassName = student?.classRef?.name;
    const myTingkat = student?.classRef?.tingkat ? String(student.classRef.tingkat) : null;

    return raw.filter((e) => {
      // Jika ujian umum untuk semua
      if (!e.class_id && !e.grade) return true;
      // Jika ada target rombel
      if (myClassName && e.class_name && e.class_name.toLowerCase() === myClassName.toLowerCase()) return true;
      // Jika ada target jenjang/tingkat (7, 8, atau 9)
      if (myTingkat && e.grade && String(e.grade) === myTingkat) return true;
      return false;
    });
  } catch (err) {
    console.error("Gagal membaca ujian CBT:", err);
    return [];
  }
}

/**
 * Cek ujian baru di cbt_tka.exams dan siarkan notifikasi (🔔) serta pengumuman (📢) ke siswa secara otomatis.
 */
export async function broadcastNewCbtExams(): Promise<{ broadcasted: number }> {
  try {
    const exams = await prisma.$queryRawUnsafe<CbtExamItem[]>(`
      SELECT e.id, e.title, e.description, e.class_id, e.grade, e.duration_minutes, e.start_at, e.end_at, e.status,
             c.name AS class_name
      FROM cbt_tka.exams e
      LEFT JOIN cbt_tka.classes c ON c.id = e.class_id
      WHERE e.status IN ('active', 'published', 'scheduled')
    `);

    let broadcasted = 0;
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    if (!adminUser) return { broadcasted: 0 };

    for (const exam of exams) {
      const kindKey = `cbt-exam-${exam.id}`;
      // Cek apakah notifikasi untuk exam ini sudah pernah dibuat
      const existing = await prisma.notification.findFirst({
        where: { kind: kindKey },
        select: { id: true },
      });

      if (existing) continue;

      const jadwalInfo = exam.start_at
        ? `Jadwal: ${new Date(exam.start_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`
        : "Jadwal telah aktif";
      const notifMsg = `📋 Ujian CBT Tersedia: ${exam.title} (${jadwalInfo}, durasi ${exam.duration_minutes} menit). Klik untuk info & login.`;

      if (exam.class_name) {
        // Ujian spesifik kelas tertentu
        const cls = await prisma.class.findFirst({
          where: { name: exam.class_name },
          select: { id: true },
        });
        if (cls) {
          await notifyClass(cls.id, kindKey, notifMsg, "/ujian");
          await prisma.announcement.create({
            data: {
              judul: `📋 Jadwal Ujian CBT: ${exam.title}`,
              isi: `Telah dijadwalkan ujian "${exam.title}" untuk kelas ${exam.class_name}.\n${jadwalInfo}\nDurasi pengerjaan: ${exam.duration_minutes} menit.\n${exam.description ? `\nKeterangan: ${exam.description}\n` : ""}\nSiswa diharapkan membuka menu Ujian di portal untuk bersiap dan login ke platform CBT.`,
              target: "KELAS",
              classId: cls.id,
              authorId: adminUser.id,
            },
          }).catch(() => {});
          broadcasted++;
        }
      } else if (exam.grade) {
        // Ujian spesifik jenjang tertentu (mis. kelas 7)
        const classes = await prisma.class.findMany({
          where: { tingkat: Number(exam.grade) },
          select: { id: true, name: true },
        });
        for (const cls of classes) {
          await notifyClass(cls.id, kindKey, notifMsg, "/ujian");
        }
        await prisma.announcement.create({
          data: {
            judul: `📋 Jadwal Ujian CBT Jenjang Kelas ${exam.grade}: ${exam.title}`,
            isi: `Telah dijadwalkan ujian "${exam.title}" untuk seluruh siswa jenjang kelas ${exam.grade}.\n${jadwalInfo}\nDurasi pengerjaan: ${exam.duration_minutes} menit.\n${exam.description ? `\nKeterangan: ${exam.description}\n` : ""}\nSiswa diharapkan membuka menu Ujian di portal untuk bersiap dan login ke platform CBT.`,
            target: "SEMUA",
            authorId: adminUser.id,
          },
        }).catch(() => {});
        broadcasted++;
      } else {
        // Ujian umum semua siswa
        const students = await prisma.user.findMany({
          where: { role: "SISWA", isActive: true, deletedAt: null },
          select: { id: true },
        });
        for (const s of students) {
          await createNotification(s.id, kindKey, notifMsg, "/ujian");
        }
        await prisma.announcement.create({
          data: {
            judul: `📋 Jadwal Ujian CBT Sekolah: ${exam.title}`,
            isi: `Telah dijadwalkan ujian "${exam.title}" untuk seluruh siswa.\n${jadwalInfo}\nDurasi pengerjaan: ${exam.duration_minutes} menit.\n${exam.description ? `\nKeterangan: ${exam.description}\n` : ""}\nSiswa diharapkan membuka menu Ujian di portal untuk bersiap dan login ke platform CBT.`,
            target: "SEMUA",
            authorId: adminUser.id,
          },
        }).catch(() => {});
        broadcasted++;
      }
    }

    return { broadcasted };
  } catch (err) {
    console.error("Gagal menyiarkan notifikasi ujian CBT:", err);
    return { broadcasted: 0 };
  }
}

/**
 * Sinkronisasi data siswa aktif dari Portal Panglima ke database cbt_tka.users & classes.
 * Selama cbt_tka.users masih TABEL fisik (belum VIEW per P1-A3), fallback SQL langsung
 * tetap dipakai. Setelah migrasi VIEW (P7), hapus fallback INSERT di bawah.
 * Path CLI Laravel diambil dari env CBT_PATH agar tidak hardcoded Windows.
 */
export async function syncStudentsToCbt(): Promise<{ synced: number; errors: number }> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);
    const cbtPath = process.env.CBT_PATH ?? "";

    if (cbtPath) {
      try {
        const { stdout } = await execAsync("php artisan cbt:sync-students", { cwd: cbtPath });
        const match = stdout.match(/Berhasil diproses:\s*(\d+)/);
        const syncedCount = match ? Number(match[1]) : 0;
        return { synced: syncedCount, errors: 0 };
      } catch (cmdErr) {
        console.warn("Artisan sync gagal, menggunakan fallback SQL:", cmdErr);
      }
    } else {
      console.warn("CBT_PATH tidak diset — lewati artisan, langsung fallback SQL.");
    }

    const students = await prisma.user.findMany({
      where: { role: "SISWA", isActive: true, deletedAt: null },
      include: { classRef: true },
    });

    let synced = 0;
    let errors = 0;

    for (const s of students) {
      try {
        let cbtClassId: bigint | null = null;
        if (s.classRef) {
          const cbtClasses = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
            `SELECT id FROM cbt_tka.classes WHERE name = ? LIMIT 1`,
            s.classRef.name
          );
          if (cbtClasses.length > 0) {
            cbtClassId = cbtClasses[0].id;
          } else {
            await prisma.$queryRawUnsafe(
              `INSERT INTO cbt_tka.classes (name, grade, academic_year, is_active, created_at, updated_at) VALUES (?, ?, '2026/2027', 1, NOW(), NOW())`,
              s.classRef.name,
              String(s.classRef.tingkat)
            );
            const created = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
              `SELECT id FROM cbt_tka.classes WHERE name = ? LIMIT 1`,
              s.classRef.name
            );
            if (created.length > 0) cbtClassId = created[0].id;
          }
        }

        const username = s.nisn || s.username;
        await prisma.$queryRawUnsafe(`
          INSERT INTO cbt_tka.users (username, name, email, password, role, class_id, nisn, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'siswa', ?, ?, 1, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            password = VALUES(password),
            class_id = VALUES(class_id),
            nisn = VALUES(nisn),
            is_active = 1,
            updated_at = NOW()
        `, username, s.nama, s.email, s.passwordHash, cbtClassId, s.nisn);

        synced++;
      } catch (e) {
        console.error(`Gagal sync siswa ${s.username} ke CBT:`, e);
        errors++;
      }
    }

    return { synced, errors };
  } catch (err) {
    console.error("Gagal sinkronisasi siswa ke CBT:", err);
    return { synced: 0, errors: 1 };
  }
}
