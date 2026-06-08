import { z } from "zod";
import type { AgentSkill, AgentContext, Dossier, ConnectionFinding } from "@graver-ai/shared";

const inputSchema = z.object({
  dossier: z.object({
    executiveSummary: z.string(),
    findings: z.array(z.object({
      subClaimId: z.string(),
      narrative: z.string(),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
      contradictions: z.array(z.string()),
    })),
    connections: z.array(z.object({
      entityIdentifier: z.string(),
      sources: z.array(z.string()),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
      notes: z.string(),
    })),
    gaps: z.array(z.string()),
    overallConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    sourceAttribution: z.array(z.object({
      claim: z.string(),
      sourceType: z.enum(["sqlite", "exa"]),
      sourceDetail: z.string(),
    })),
    suggestedNextSteps: z.array(z.string()),
  }),
  investigationId: z.string(),
  connections: z.array(z.object({
    entityIdentifier: z.string(),
    sources: z.array(z.string()),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    notes: z.string(),
  })),
  tip: z.string(),
});

const outputSchema = z.object({
  pagesWritten: z.array(z.string()),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const wikiWritebackSkill: AgentSkill<Input, Output> = {
  name: "wikiWriteback",
  description:
    "Files investigation results as new findings pages in the wiki and updates knowledge base indexes with cross-KB connection notes.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const pagesWritten: string[] = [];
    const now = new Date().toISOString();

    // 1. Write the main findings page to the global findings directory
    const findingsPagePath = `findings/${input.investigationId}.md`;
    const findingsContent = buildFindingsMarkdown(input.dossier, input.tip, input.investigationId, now);
    await context.wikiStore.writePage("findings", `${input.investigationId}.md`, findingsContent);
    pagesWritten.push(findingsPagePath);

    context.emitReasoning?.(`Written findings page: ${findingsPagePath}\n`);

    // 2. Update relevant KB index pages with cross-KB connection notes
    const kbSources = new Set<string>();
    for (const c of input.connections) {
      for (const src of c.sources) {
        if (src.startsWith("kb_")) {
          kbSources.add(src);
        }
      }
    }

    for (const kbName of kbSources) {
      try {
        const indexContent = await context.wikiStore.readPage(kbName, "index.md");
        if (indexContent) {
          const updatedIndex = appendConnectionNotes(indexContent, input.connections, kbName, input.investigationId, now);
          await context.wikiStore.writePage(kbName, "index.md", updatedIndex);
          pagesWritten.push(`${kbName}/index.md`);
          context.emitReasoning?.(`Updated index for ${kbName}\n`);
        }
      } catch {
        // skip if KB doesn't exist
      }
    }

    return { pagesWritten };
  },
};

function escapeYamlString(value: string): string {
  // Double-quote YAML scalar: escape backslashes and double quotes
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildFindingsMarkdown(
  dossier: Dossier,
  tip: string,
  investigationId: string,
  timestamp: string
): string {
  const frontmatter = `---\ninvestigation_id: ${investigationId}\ntip: "${escapeYamlString(tip)}"\n---\n\n`;

  const findingsMd = dossier.findings.map((f) => {
    const heading = f.claimText || f.subClaimId;
    const idLabel = f.claimText ? ` *(${f.subClaimId})*` : "";
    const contra = f.contradictions.length > 0
      ? `\n\n**Contradictions:**\n\n${f.contradictions.map((c) => `- ${c}`).join("\n")}\n`
      : "";
    const sources = f.sources && f.sources.length > 0
      ? `\n\n**Sources Used:**\n\n${f.sources.map((s) => {
        if (s.sourceType === "exa" && s.link.startsWith("http")) {
          return `- [${s.link}](${s.link}): ${s.description}`;
        }
        return `- ${s.link}: ${s.description}`;
      }).join("\n")}\n`
      : "";
    return `### ${heading}${idLabel}\n\n**Confidence:** ${f.confidence}\n\n${f.narrative}${contra}${sources}`;
  }).join("\n\n---\n\n");

  const connectionsMd = dossier.connections.map((c) =>
    `- [[${c.entityIdentifier}]] (${c.confidence}): ${c.notes} — sources: ${c.sources.join(", ")}`
  ).join("\n");

  const gapsMd = dossier.gaps.length > 0
    ? dossier.gaps.map((g) => `- ${g}`).join("\n")
    : "_No significant gaps identified._";

  const attributionMd = dossier.sourceAttribution.map((a) => {
    const detail = a.sourceDetail;
    return `- ${a.claim} — *${a.sourceType}*: ${detail}`;
  }).join("\n");

  const nextStepsMd = dossier.suggestedNextSteps.map((s) => `- ${s}`).join("\n");

  return frontmatter +
    `# Investigation Findings: ${investigationId}\n\n` +
    `**Tip:** ${tip}\n\n` +
    `**Date:** ${timestamp}\n\n` +
    `**Overall Confidence:** ${dossier.overallConfidence}\n\n` +
    `---\n\n` +
    `## Executive Summary\n\n${dossier.executiveSummary}\n\n` +
    `---\n\n` +
    `## Findings by Sub-Claim\n\n${findingsMd}\n\n` +
    `---\n\n` +
    `## Cross-Source Connections\n\n${connectionsMd || "_No cross-source connections identified._"}\n\n` +
    `---\n\n` +
    `## Evidence Gaps\n\n${gapsMd}\n\n` +
    `---\n\n` +
    `## Source Attribution\n\n${attributionMd || "_No source attribution recorded._"}\n\n` +
    `---\n\n` +
    `## Suggested Next Steps\n\n${nextStepsMd || "_No next steps suggested._"}\n`;
}

function appendConnectionNotes(
  indexContent: string,
  connections: ConnectionFinding[],
  kbName: string,
  investigationId: string,
  timestamp: string
): string {
  const relevantConnections = connections.filter((c) => c.sources.includes(kbName));
  if (relevantConnections.length === 0) return indexContent;

  const sectionHeader = "## Cross-Knowledge-Base Connections";
  const entry = `\n- **${investigationId}** (${timestamp.split("T")[0]}): ` +
    relevantConnections.map((c) =>
      `${c.entityIdentifier} (${c.confidence}) — ${c.notes}`
    ).join("; ");

  if (indexContent.includes(sectionHeader)) {
    // Append after the header
    return indexContent.replace(
      new RegExp(`(${sectionHeader}.*?)(\\n## |\\n---|$)`),
      `$1${entry}$2`
    );
  } else {
    // Append at the end
    return indexContent.trimEnd() + "\n\n" + sectionHeader + "\n" + entry + "\n";
  }
}
