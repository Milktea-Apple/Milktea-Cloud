import { randomUUID } from "node:crypto";
import { ApiError } from "./api";
import { execute, now, queryAll, queryOne, transaction } from "./db";
import { deleteStorageKey } from "./storage";
import {
  mimeForName,
  previewKindOf,
  type Crumb,
  type FileDTO,
  type PreviewKind,
} from "./shared";

export type FileRow = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  kind: "file" | "folder";
  size: number;
  mime: string;
  storage_key: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  trash_batch: string | null;
};

export type TrashDTO = FileDTO & {
  deletedAt: number;
  location: string;
  itemCount: number;
};

export type FileSort = "name-asc" | "name-desc" | "updated-desc" | "updated-asc" | "size-desc" | "size-asc";

const collator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });

export function toFileDTO(row: FileRow): FileDTO {
  const ext = row.kind === "file" && row.name.includes(".") ? row.name.split(".").pop()!.toLowerCase() : "";
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    kind: row.kind,
    size: Number(row.size),
    mime: row.mime,
    previewKind: previewKindOf(row.name, row.kind),
    ext,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function splitExtension(name: string) {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return { base: name, ext: "" };
  const ext = name.slice(index);
  if (ext.length > 18) return { base: name, ext: "" };
  return { base: name.slice(0, index), ext };
}

export function sanitizeName(value: unknown) {
  if (typeof value !== "string") throw new ApiError(400, "名称格式不正确。", "bad_name");
  let name = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .replace(/[<>:"|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  name = name.replace(/^\.{2,}[-_\s]*/, "");
  if (!name || name === "." || name === "..") {
    throw new ApiError(400, "名称不能为空。", "bad_name");
  }
  const chars = Array.from(name);
  if (chars.length > 160) {
    const { ext } = splitExtension(name);
    name = chars.slice(0, 160 - ext.length).join("").trim() + ext;
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) name = `_${name}`;
  return name;
}

export function uniqueName(ownerId: string, parentId: string | null, desired: string, excludeId?: string) {
  const rows = queryAll<{ name: string }>(
    `SELECT name FROM files
     WHERE owner_id = ? AND parent_id IS ? AND deleted_at IS NULL AND id != ?`,
    ownerId,
    parentId,
    excludeId || "",
  );
  const taken = new Set(rows.map((row) => row.name.toLocaleLowerCase()));
  if (!taken.has(desired.toLocaleLowerCase())) return desired;
  const { base, ext } = splitExtension(desired);
  for (let index = 2; index < 10_000; index += 1) {
    const suffix = ` (${index})`;
    const candidateBase = Array.from(base)
      .slice(0, Math.max(1, 156 - suffix.length - ext.length))
      .join("")
      .trimEnd();
    const candidate = `${candidateBase}${suffix}${ext}`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new ApiError(409, "同一目录下同名文件太多了。", "name_conflict");
}

export function requireFolder(ownerId: string, folderId: string | null) {
  if (!folderId) return null;
  const row = queryOne<FileRow>(
    "SELECT * FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
    folderId,
    ownerId,
  );
  if (!row || row.kind !== "folder") {
    throw new ApiError(404, "文件夹不存在或已被删除。", "folder_not_found");
  }
  return row;
}

export function getFileRow(ownerId: string, fileId: string, includeDeleted = false) {
  const row = queryOne<FileRow>(
    `SELECT * FROM files WHERE id = ? AND owner_id = ? ${includeDeleted ? "" : "AND deleted_at IS NULL"}`,
    fileId,
    ownerId,
  );
  if (!row) throw new ApiError(404, "文件不存在或已被删除。", "file_not_found");
  return row;
}

export function breadcrumbs(ownerId: string, folderId: string | null): Crumb[] {
  const trail: Crumb[] = [{ id: null, name: "全部文件" }];
  if (!folderId) return trail;
  const chain: Crumb[] = [];
  let currentId: string | null = folderId;
  let guard = 0;
  while (currentId && guard < 64) {
    const row: FileRow | undefined = queryOne<FileRow>(
      "SELECT * FROM files WHERE id = ? AND owner_id = ?",
      currentId,
      ownerId,
    );
    if (!row) throw new ApiError(404, "文件夹不存在。", "folder_not_found");
    chain.push({ id: row.id, name: row.name });
    currentId = row.parent_id;
    guard += 1;
  }
  return trail.concat(chain.reverse());
}

export function locationLabel(ownerId: string, parentId: string | null) {
  if (!parentId) return "全部文件";
  try {
    return breadcrumbs(ownerId, parentId)
      .map((crumb) => crumb.name)
      .join(" / ");
  } catch {
    return "全部文件";
  }
}

export function listDirectory(ownerId: string, parentId: string | null, sort: FileSort = "name-asc") {
  const folder = parentId ? requireFolder(ownerId, parentId) : null;
  const rows = queryAll<FileRow>(
    `SELECT * FROM files
     WHERE owner_id = ? AND parent_id IS ? AND deleted_at IS NULL`,
    ownerId,
    parentId,
  );
  const entries = rows.map(toFileDTO);
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    switch (sort) {
      case "name-desc":
        return -collator.compare(a.name, b.name);
      case "updated-desc":
        return b.updatedAt - a.updatedAt;
      case "updated-asc":
        return a.updatedAt - b.updatedAt;
      case "size-desc":
        return b.size - a.size;
      case "size-asc":
        return a.size - b.size;
      default:
        return collator.compare(a.name, b.name);
    }
  });
  return {
    folder: folder ? toFileDTO(folder) : null,
    breadcrumbs: breadcrumbs(ownerId, parentId),
    entries,
  };
}

export function usageFor(ownerId: string) {
  const files = queryOne<{ bytes: number; files: number; folders: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'file' THEN size ELSE 0 END), 0) AS bytes,
       COUNT(CASE WHEN kind = 'file' AND deleted_at IS NULL THEN 1 END) AS files,
       COUNT(CASE WHEN kind = 'folder' AND deleted_at IS NULL THEN 1 END) AS folders
     FROM files WHERE owner_id = ?`,
    ownerId,
  );
  const shares = queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM shares WHERE owner_id = ?",
    ownerId,
  );
  const trash = queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM files f
     LEFT JOIN files p ON p.id = f.parent_id
     WHERE f.owner_id = ? AND f.deleted_at IS NOT NULL
       AND (f.parent_id IS NULL OR p.deleted_at IS NULL)`,
    ownerId,
  );
  return {
    usage: Number(files?.bytes || 0),
    fileCount: Number(files?.files || 0),
    folderCount: Number(files?.folders || 0),
    shareCount: Number(shares?.count || 0),
    trashCount: Number(trash?.count || 0),
  };
}

export function touchParent(ownerId: string, parentId: string | null) {
  if (!parentId) return;
  execute(
    "UPDATE files SET updated_at = ? WHERE id = ? AND owner_id = ? AND kind = 'folder'",
    now(),
    parentId,
    ownerId,
  );
}

export function createFolder(ownerId: string, parentId: string | null, rawName: string) {
  requireFolder(ownerId, parentId);
  const name = uniqueName(ownerId, parentId, sanitizeName(rawName));
  const id = randomUUID();
  const timestamp = now();
  execute(
    `INSERT INTO files (id, owner_id, parent_id, name, kind, size, mime, storage_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'folder', 0, 'inode/directory', NULL, ?, ?)`,
    id,
    ownerId,
    parentId,
    name,
    timestamp,
    timestamp,
  );
  touchParent(ownerId, parentId);
  return toFileDTO(getFileRow(ownerId, id));
}

export function createFileRecord(options: {
  ownerId: string;
  parentId: string | null;
  name: string;
  size: number;
  storageKey: string;
}) {
  requireFolder(options.ownerId, options.parentId);
  const name = uniqueName(options.ownerId, options.parentId, sanitizeName(options.name));
  const id = randomUUID();
  const timestamp = now();
  execute(
    `INSERT INTO files
       (id, owner_id, parent_id, name, kind, size, mime, storage_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'file', ?, ?, ?, ?, ?)`,
    id,
    options.ownerId,
    options.parentId,
    name,
    options.size,
    mimeForName(name),
    options.storageKey,
    timestamp,
    timestamp,
  );
  touchParent(options.ownerId, options.parentId);
  return toFileDTO(getFileRow(options.ownerId, id));
}

export function renameFile(ownerId: string, fileId: string, rawName: string) {
  const row = getFileRow(ownerId, fileId);
  const name = sanitizeName(rawName);
  if (name === row.name) return toFileDTO(row);
  const finalName = uniqueName(ownerId, row.parent_id, name, fileId);
  execute(
    "UPDATE files SET name = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    finalName,
    now(),
    fileId,
    ownerId,
  );
  return toFileDTO(getFileRow(ownerId, fileId));
}

export function descendantIds(ownerId: string, fileId: string) {
  return queryAll<{ id: string }>(
    `WITH RECURSIVE subtree(id) AS (
       SELECT id FROM files WHERE id = ? AND owner_id = ?
       UNION ALL
       SELECT f.id FROM files f JOIN subtree s ON f.parent_id = s.id WHERE f.owner_id = ?
     )
     SELECT id FROM subtree`,
    fileId,
    ownerId,
    ownerId,
  ).map((row) => row.id);
}

export function moveFile(ownerId: string, fileId: string, parentId: string | null) {
  const row = getFileRow(ownerId, fileId);
  requireFolder(ownerId, parentId);
  if (parentId === row.parent_id) return toFileDTO(row);
  if (parentId && (parentId === fileId || descendantIds(ownerId, fileId).includes(parentId))) {
    throw new ApiError(400, "不能把文件夹移动到它自己里面。", "bad_move");
  }
  const finalName = uniqueName(ownerId, parentId, row.name, fileId);
  execute(
    "UPDATE files SET parent_id = ?, name = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    parentId,
    finalName,
    now(),
    fileId,
    ownerId,
  );
  touchParent(ownerId, row.parent_id);
  touchParent(ownerId, parentId);
  return toFileDTO(getFileRow(ownerId, fileId));
}

export function trashFile(ownerId: string, fileId: string) {
  const row = getFileRow(ownerId, fileId);
  const batch = randomUUID();
  const timestamp = now();
  transaction(() => {
    execute(
      `WITH RECURSIVE subtree(id) AS (
         SELECT id FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
         UNION ALL
         SELECT f.id FROM files f JOIN subtree s ON f.parent_id = s.id
         WHERE f.owner_id = ? AND f.deleted_at IS NULL
       )
       UPDATE files SET deleted_at = ?, trash_batch = ?
       WHERE id IN (SELECT id FROM subtree)`,
      fileId,
      ownerId,
      ownerId,
      timestamp,
      batch,
    );
    touchParent(ownerId, row.parent_id);
  });
  return { id: fileId, name: row.name, batch };
}

export function subtreeStats(ownerId: string, fileId: string) {
  const row = queryOne<{ bytes: number; items: number }>(
    `WITH RECURSIVE subtree(id) AS (
       SELECT id FROM files WHERE id = ? AND owner_id = ?
       UNION ALL
       SELECT f.id FROM files f JOIN subtree s ON f.parent_id = s.id WHERE f.owner_id = ?
     )
     SELECT COALESCE(SUM(CASE WHEN kind = 'file' THEN size ELSE 0 END), 0) AS bytes,
            COUNT(CASE WHEN kind = 'file' THEN 1 END) AS items
     FROM files WHERE id IN (SELECT id FROM subtree)`,
    fileId,
    ownerId,
    ownerId,
  );
  return { bytes: Number(row?.bytes || 0), items: Number(row?.items || 0) };
}

export function listTrash(ownerId: string) {
  const rows = queryAll<FileRow>(
    `SELECT f.* FROM files f
     LEFT JOIN files p ON p.id = f.parent_id
     WHERE f.owner_id = ? AND f.deleted_at IS NOT NULL
       AND (f.parent_id IS NULL OR p.deleted_at IS NULL)
     ORDER BY f.deleted_at DESC`,
    ownerId,
  );
  return rows.map((row) => {
    const dto = toFileDTO(row);
    const stats = row.kind === "folder" ? subtreeStats(ownerId, row.id) : { bytes: row.size, items: 1 };
    return {
      ...dto,
      size: row.kind === "folder" ? stats.bytes : dto.size,
      deletedAt: Number(row.deleted_at),
      location: locationLabel(ownerId, row.parent_id),
      itemCount: stats.items,
    } satisfies TrashDTO;
  });
}

export function restoreFile(ownerId: string, fileId: string) {
  const row = queryOne<FileRow>(
    "SELECT * FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL",
    fileId,
    ownerId,
  );
  if (!row) throw new ApiError(404, "回收站里没有这个项目。", "trash_not_found");
  let destination = row.parent_id;
  if (destination) {
    const parent = queryOne<FileRow>(
      "SELECT * FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NULL AND kind = 'folder'",
      destination,
      ownerId,
    );
    if (!parent) destination = null;
  }
  const name = uniqueName(ownerId, destination, row.name, fileId);
  transaction(() => {
    execute(
      `WITH RECURSIVE subtree(id) AS (
         SELECT id FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL
         UNION ALL
         SELECT f.id FROM files f JOIN subtree s ON f.parent_id = s.id
         WHERE f.owner_id = ? AND f.deleted_at IS NOT NULL
       )
       UPDATE files SET deleted_at = NULL, trash_batch = NULL
       WHERE id IN (SELECT id FROM subtree)`,
      fileId,
      ownerId,
      ownerId,
    );
    execute(
      "UPDATE files SET parent_id = ?, name = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
      destination,
      name,
      now(),
      fileId,
      ownerId,
    );
    touchParent(ownerId, destination);
  });
  return toFileDTO(getFileRow(ownerId, fileId));
}

export function storageKeysUnder(ownerId: string, fileId: string) {
  return queryAll<{ storage_key: string | null }>(
    `WITH RECURSIVE subtree(id) AS (
       SELECT id FROM files WHERE id = ? AND owner_id = ?
       UNION ALL
       SELECT f.id FROM files f JOIN subtree s ON f.parent_id = s.id WHERE f.owner_id = ?
     )
     SELECT storage_key FROM files
     WHERE id IN (SELECT id FROM subtree) AND storage_key IS NOT NULL`,
    fileId,
    ownerId,
    ownerId,
  )
    .map((row) => row.storage_key)
    .filter((key): key is string => Boolean(key));
}

export function purgeFile(ownerId: string, fileId: string) {
  const row = queryOne<FileRow>(
    "SELECT * FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL",
    fileId,
    ownerId,
  );
  if (!row) throw new ApiError(404, "回收站里没有这个项目。", "trash_not_found");
  const keys = storageKeysUnder(ownerId, fileId);
  transaction(() => {
    execute("DELETE FROM files WHERE id = ? AND owner_id = ?", fileId, ownerId);
    touchParent(ownerId, row.parent_id);
  });
  keys.forEach(deleteStorageKey);
  return { name: row.name, freed: keys.length };
}

export function emptyTrash(ownerId: string) {
  const rows = queryAll<{ storage_key: string | null }>(
    "SELECT storage_key FROM files WHERE owner_id = ? AND deleted_at IS NOT NULL",
    ownerId,
  );
  const keys = rows.map((row) => row.storage_key).filter((key): key is string => Boolean(key));
  execute("DELETE FROM files WHERE owner_id = ? AND deleted_at IS NOT NULL", ownerId);
  keys.forEach(deleteStorageKey);
  return { count: keys.length };
}

export function searchFiles(ownerId: string, query: string) {
  const trimmed = query.trim().slice(0, 100);
  if (!trimmed) return [] as (FileDTO & { location: string })[];
  const escaped = trimmed.replace(/[\\%_]/g, "\\$&");
  const rows = queryAll<FileRow>(
    `SELECT * FROM files
     WHERE owner_id = ? AND deleted_at IS NULL AND name LIKE ? ESCAPE '\\'
     ORDER BY kind DESC, updated_at DESC
     LIMIT 100`,
    ownerId,
    `%${escaped}%`,
  );
  return rows.map((row) => ({
    ...toFileDTO(row),
    location: locationLabel(ownerId, row.parent_id),
  }));
}

export function listFolders(ownerId: string) {
  const rows = queryAll<FileRow>(
    `SELECT * FROM files
     WHERE owner_id = ? AND deleted_at IS NULL AND kind = 'folder'
     ORDER BY name COLLATE NOCASE`,
    ownerId,
  );
  return rows
    .map(toFileDTO)
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function countActiveFiles(ownerId: string) {
  const row = queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM files WHERE owner_id = ? AND deleted_at IS NULL",
    ownerId,
  );
  return Number(row?.count || 0);
}

export type { FileDTO, PreviewKind };
