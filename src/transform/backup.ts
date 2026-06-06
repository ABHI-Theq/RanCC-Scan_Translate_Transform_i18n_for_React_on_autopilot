import fs from "node:fs";
import path from "node:path";

export const BACKUP_DIR = ".edge-backups";

/**
 * Ensures the backup directory exists.
 */
export function ensureBackupDir(): void {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Writes the original source of a file into the backup directory,
 * preserving the relative folder structure.
 *
 * e.g.  src/components/App.tsx
 *    => .edge-backups/src/components/App.tsx
 */
export function backupFile(filePath: string, content: string): void {
  const dest = path.join(BACKUP_DIR, filePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, "utf8");
}
