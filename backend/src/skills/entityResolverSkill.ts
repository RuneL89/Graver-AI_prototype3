import { z } from "zod";
import type { AgentSkill, AgentContext, EvidenceBundle, ConnectionFinding } from "@graver-ai/shared";

const inputSchema = z.object({
  evidence: z.array(z.object({
    subClaimId: z.string(),
    sourceType: z.enum(["sqlite", "exa"]),
    query: z.string(),
    results: z.array(z.unknown()),
    timestamp: z.string(),
  })),
  tip: z.string(),
});

// Lenient raw schema that accepts common LLM field name variations
const rawConnectionSchema = z.object({
  entityIdentifier: z.string().optional(),
  entity: z.string().optional(),
  identifier: z.string().optional(),
  name: z.string().optional(),
  sources: z.array(z.string()).optional(),
  source: z.array(z.string()).optional(),
  kbSources: z.array(z.string()).optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  confidenceScore: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  notes: z.string().optional(),
  note: z.string().optional(),
  description: z.string().optional(),
});

const rawOutputSchema = z.object({
  connections: z.array(rawConnectionSchema).optional(),
  contradictions: z.array(z.string()).optional(),
  confidenceScores: z.record(z.number()).optional(),
});

const outputSchema = z.object({
  connections: z.array(z.object({
    entityIdentifier: z.string(),
    sources: z.array(z.string()),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    notes: z.string(),
  })),
  contradictions: z.array(z.string()),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

function normalizeConnections(raw: z.infer<typeof rawOutputSchema>): Output {
  const connections: ConnectionFinding[] = (raw.connections || []).map((c) => ({
    entityIdentifier: c.entityIdentifier || c.entity || c.identifier || c.name || "unknown",
    sources: c.sources || c.source || c.kbSources || [],
    confidence: c.confidence || c.confidenceScore || "MEDIUM",
    notes: c.notes || c.note || c.description || "",
  }));

  const contradictions = raw.contradictions || [];

  return { connections, contradictions };
}

export const entityResolverSkill: AgentSkill<Input, Output> = {
  name: "entityResolver",
  description:
    "Finds shared identifiers across result sets from multiple knowledge bases, flags potential matches, aliases, and cross-references. Notes contradictions between sources.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    // Build evidence summary for the prompt
    const evidenceSummaries = input.evidence.map((e) => {
      const resultsPreview = JSON.stringify(e.results).slice(0, 800);
      return `Source: ${e.sourceType}\nQuery: ${e.query}\nResults preview: ${resultsPreview}\n`;
    }).join("\n---\n");

    const prompt = `You are an entity resolution specialist. Given the following evidence from multiple knowledge bases and web search, identify shared identifiers, potential matches, aliases, and cross-references.

TIP BEING INVESTIGATED:
"""${input.tip}"""

EVIDENCE FROM QUERIED SOURCES:
${evidenceSummaries || "(no evidence available)"}

Your task:
1. Look for shared identifiers across result sets: CVR numbers, names, dates, locations, company names, person names, etc.
2. Flag potential matches and aliases (e.g., "Company A Ltd" vs "A Company").
3. Note cross-references between knowledge bases.
4. Explicitly note when Exa (web) results confirm or contradict local database results.
5. Identify any contradictions between sources.

For each connection found, return a JSON object with these exact fields:
- "entityIdentifier": the shared identifier or entity name
- "sources": array of source names (e.g., ["kb_business_units", "exa"])
- "confidence": "HIGH", "MEDIUM", or "LOW"
- "notes": brief explanation of the connection

Also return a "contradictions" array with strings describing any contradictions found.

Respond with JSON containing "connections" and "contradictions" arrays.`;

    context.emitReasoning?.("Resolving entities across evidence sources...\n");

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeConnections(rawResult);

    context.emitReasoning?.(`Found ${result.connections.length} cross-source connections.\n`);
    for (const c of result.connections) {
      context.emitReasoning?.(`  → ${c.entityIdentifier} (${c.confidence}): ${c.notes}\n`);
    }
    if (result.contradictions.length > 0) {
      context.emitReasoning?.(`Found ${result.contradictions.length} contradiction(s).\n`);
    }

    return result;
  },
};
