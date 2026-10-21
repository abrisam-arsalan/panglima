// Reset/buat akun login ADMIN dgn password baku — TANPA butuh bcryptjs di server.
// Mengandalkan @prisma/client (ada di standalone) + hash bcrypt yang diprecompute.
// Password bawaan skrip ini:  Admin#5Tegal2026   (hash $2a$, diverifikasi app login).
//
// Jalankan di server (setelah schema termigrate):
//   cd /var/www/panglima && sudo -u deploy node --env-file=.env scripts-server/reset-admin.mjs
import { PrismaClient } from "@prisma/client";

const USERNAME = process.argv[2] ?? "admin";
const HASH = "$2a$10$o8Wfu1MHfInG7RO7seyY4Oq7N/EocpbnM3QWf9jKJNcIULMK5OS8S"; // = Admin#5Tegal2026
const PW_HINT = "Admin#5Tegal2026";

const p = new PrismaClient();
try {
  const r = await p.user.upsert({
    where: { username: USERNAME },
    update: { passwordHash: HASH, role: "ADMIN", isActive: true, deletedAt: null },
    create: { username: USERNAME, nama: "Administrator", role: "ADMIN", passwordHash: HASH },
  });
  console.log(`✔ siap login — username: ${r.username}   password: ${PW_HINT}   (id ${String(r.id)})`);
} catch (e) {
  console.error("Gagal:", e.message);
  console.error("Pastikan schema termigrate: RUNBOOK §3 (prisma migrate deploy).");
  process.exit(1);
} finally {
  await p.$disconnect();
}
