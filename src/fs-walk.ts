import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const BINARY_CERT_EXTENSIONS = [".der", ".p12", ".pfx", ".pkcs12", ".pdf"];

export interface WalkedFile {
  path: string;
  absolutePath: string;
}

async function walkDir(dir: string, root: string, out: WalkedFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkDir(join(dir, entry.name), root, out);
    } else if (entry.isFile()) {
      const absolutePath = join(dir, entry.name);
      out.push({ path: relative(root, absolutePath), absolutePath });
    }
  }
}

/** A single file scans as itself; a directory walks recursively, pruning
 * SKIP_DIRS before descending (not after) so scanning a typical project root
 * doesn't first enumerate its entire node_modules. */
export async function walk(root: string): Promise<WalkedFile[]> {
  const info = await stat(root);
  if (!info.isDirectory()) return [{ path: root, absolutePath: root }];

  const out: WalkedFile[] = [];
  await walkDir(root, root, out);
  return out;
}

export function isBinaryCert(name: string): boolean {
  const lower = name.toLowerCase();
  return BINARY_CERT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
