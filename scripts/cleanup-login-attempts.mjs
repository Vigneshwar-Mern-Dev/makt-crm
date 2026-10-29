import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupSecurity() {
  console.log("Cleaning up old security buckets and login attempts...");
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const delRateLimits = await prisma.rateLimitBucket.deleteMany({
    where: {
      updatedAt: { lte: cutoff },
    },
  });

  const delLoginAttempts = await prisma.loginAttempt.deleteMany({
    where: {
      createdAt: { lte: cutoff },
    },
  });

  console.log(
    `Cleaned ${delRateLimits.count} stale rate-limit buckets and ${delLoginAttempts.count} old login attempts.`,
  );
  await prisma.$disconnect();
}

cleanupSecurity().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
