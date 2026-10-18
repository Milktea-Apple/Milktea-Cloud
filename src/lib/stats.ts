import { queryOne } from "./db";

export function getPublicStats() {
  try {
    const users = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM users");
    const files = queryOne<{ count: number; bytes: number }>(
      "SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM files WHERE kind = 'file' AND deleted_at IS NULL",
    );
    const shares = queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM shares WHERE expires_at IS NULL OR expires_at > ?",
      Date.now(),
    );
    return {
      users: Number(users?.count || 0),
      files: Number(files?.count || 0),
      bytes: Number(files?.bytes || 0),
      shares: Number(shares?.count || 0),
    };
  } catch {
    return { users: 0, files: 0, bytes: 0, shares: 0 };
  }
}
