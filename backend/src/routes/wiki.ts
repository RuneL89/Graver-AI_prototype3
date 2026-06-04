import { Router } from "express";
import { readPage, writePage, listPages, renamePage, deletePage, deleteKb } from "../wiki/store.js";
import fs from "fs";
import path from "path";

const router = Router();
const WIKI_PATH = process.env.WIKI_PATH || "./wiki";

router.get("/wiki", async (_req, res) => {
  try {
    const entries = await fs.promises.readdir(WIKI_PATH, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    const kbs = await Promise.all(
      dirs.map(async (e) => {
        let displayName = e.name;
        try {
          const metaRaw = await fs.promises.readFile(
            path.join(WIKI_PATH, e.name, "_meta.json"),
            "utf-8"
          );
          const meta = JSON.parse(metaRaw);
          if (meta.displayName) displayName = meta.displayName;
        } catch {
          // no meta file, use directory name
        }
        return { name: e.name, displayName };
      })
    );
    res.json({ knowledgeBases: kbs });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return res.json({ knowledgeBases: [] });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get("/wiki/:kbName", async (req, res) => {
  const { kbName } = req.params;
  try {
    const pages = await listPages(kbName);
    res.json({ pages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/wiki/:kbName/*", async (req, res) => {
  const { kbName } = req.params;
  const pagePath = (req.params as any)[0];
  try {
    const content = await readPage(kbName, pagePath);
    if (content === null) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/wiki/:kbName/*", async (req, res) => {
  const { kbName } = req.params;
  const oldPath = (req.params as any)[0];
  const { newPath } = req.body;
  if (!newPath) {
    return res.status(400).json({ error: "newPath is required" });
  }
  try {
    await renamePage(kbName, oldPath, newPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/wiki/:kbName/*", async (req, res) => {
  const { kbName } = req.params;
  const pagePath = (req.params as any)[0];
  try {
    await deletePage(kbName, pagePath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/wiki/:kbName/*", async (req, res) => {
  const { kbName } = req.params;
  const pagePath = (req.params as any)[0];
  const { content } = req.body;
  try {
    await writePage(kbName, pagePath, content || "# New Page\n");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/wiki/:kbName", async (req, res) => {
  const { kbName } = req.params;
  try {
    await deleteKb(kbName);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
