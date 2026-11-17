import "server-only";

import { createHash } from "node:crypto";
import { db } from "./db";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitBucketRow = {
  count: number;
  blocked_until: Date | null;
};

export function rateLimitKey(scope: string, ...identifiers: Array<string | null | undefined>) {
  const digest = createHash("sha256")
    .update(identifiers.map((value) => value?.trim().toLowerCase() || "unknown").join("\u0000"))
    .digest("hex");

  return `${scope}:${digest}`;
}

/**
 * Consumes one request from a PostgreSQL-backed rate-limit bucket using a single atomic UPSERT.
 * Avoids interactive Serializable transactions so Neon serverless Postgres never hits P2028 pool timeouts.
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  if (options.limit < 1 || options.windowMs < 1) {
    throw new Error("Invalid rate-limit configuration.");
  }

  const now = new Date();
  const windowExpiredCutoff = new Date(now.getTime() - options.windowMs);
  const blockUntilCandidate = new Date(now.getTime() + (options.blockMs ?? options.windowMs));

  const rows = await db.$queryRaw<RateLimitBucketRow[]>`
    INSERT INTO "rate_limit_buckets" (
      "key",
      "count",
      "window_started_at",
      "blocked_until",
      "created_at",
      "updated_at"
    )
    VALUES (
      ${options.key},
      1,
      ${now},
      NULL,
      ${now},
      ${now}
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."blocked_until" IS NOT NULL
         AND "rate_limit_buckets"."blocked_until" > ${now}
          THEN "rate_limit_buckets"."count"
        WHEN "rate_limit_buckets"."window_started_at" <= ${windowExpiredCutoff}
          THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "window_started_at" = CASE
        WHEN "rate_limit_buckets"."blocked_until" IS NOT NULL
         AND "rate_limit_buckets"."blocked_until" > ${now}
          THEN "rate_limit_buckets"."window_started_at"
        WHEN "rate_limit_buckets"."window_started_at" <= ${windowExpiredCutoff}
          THEN ${now}
        ELSE "rate_limit_buckets"."window_started_at"
      END,
      "blocked_until" = CASE
        WHEN "rate_limit_buckets"."blocked_until" IS NOT NULL
         AND "rate_limit_buckets"."blocked_until" > ${now}
          THEN "rate_limit_buckets"."blocked_until"
        WHEN "rate_limit_buckets"."window_started_at" <= ${windowExpiredCutoff}
          THEN NULL
        WHEN ("rate_limit_buckets"."count" + 1) <= ${options.limit}
          THEN NULL
        ELSE GREATEST(
          "rate_limit_buckets"."window_started_at" + (${options.windowMs} * interval '1 millisecond'),
          ${blockUntilCandidate}
        )
      END,
      "updated_at" = ${now}
    RETURNING "count", "blocked_until"
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Rate-limit bucket upsert returned no row.");
  }

  const isBlocked = Boolean(row.blocked_until && row.blocked_until > now);
  const allowed = !isBlocked && row.count <= options.limit;

  return {
    allowed,
    remaining: isBlocked ? 0 : Math.max(0, options.limit - row.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil(((row.blocked_until?.getTime() ?? now.getTime() + 1000) - now.getTime()) / 1000)),
  };
}

export async function resetRateLimit(key: string) {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}
