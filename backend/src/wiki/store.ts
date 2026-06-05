import fs from "fs/promises";
import path from "path";

const WIKI_PATH = process.env.WIKI_PATH || "./wiki";

function resolveWikiPath(kbName: string, pagePath: string): string {
  // Prevent directory traversal
  const safeKb = kbName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safePage = pagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (safePage.includes("..")) {
    throw new Error("Invalid page path: directory traversal detected");
  }
  return path.join(WIKI_PATH, safeKb, safePage);
}

export async function readPage(
  kbName: string,
  pagePath: string
): Promise<string | null> {
  const filePath = resolveWikiPath(kbName, pagePath);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function writePage(
  kbName: string,
  pagePath: string,
  content: string
): Promise<void> {
  const filePath = resolveWikiPath(kbName, pagePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

export async function listPages(kbName: string): Promise<string[]> {
  const dirPath = path.join(WIKI_PATH, kbName.replace(/[^a-zA-Z0-9_-]/g, "_"));
  try {
    const entries = await fs.readdir(dirPath, { recursive: true, withFileTypes: true });
    const pages = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.relative(dirPath, path.join(e.parentPath, e.name)).replace(/\\/g, "/"));
    // Sort: index.md first, then alphabetical
    pages.sort((a, b) => {
      if (a === "index.md") return -1;
      if (b === "index.md") return 1;
      return a.localeCompare(b);
    });
    return pages;
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function renamePage(
  kbName: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  const oldFilePath = resolveWikiPath(kbName, oldPath);
  const newFilePath = resolveWikiPath(kbName, newPath);
  await fs.mkdir(path.dirname(newFilePath), { recursive: true });
  await fs.rename(oldFilePath, newFilePath);
}

export async function deletePage(
  kbName: string,
  pagePath: string
): Promise<void> {
  const filePath = resolveWikiPath(kbName, pagePath);
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err.code === "ENOENT") return;
    throw err;
  }
}

export async function deleteKb(kbName: string): Promise<void> {
  const dirPath = path.join(WIKI_PATH, kbName.replace(/[^a-zA-Z0-9_-]/g, "_"));
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err: any) {
    if (err.code === "ENOENT") return;
    throw err;
  }
}
