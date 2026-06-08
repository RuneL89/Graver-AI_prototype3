import { z } from "zod";

// ---------------------------------------------------------------------------
// Agent Skill Interface (cross-cutting contract for all pipelines)
// ---------------------------------------------------------------------------

export interface AgentSkill<Input, Output> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<Input>;
  outputSchema: z.ZodSchema<Output>;
  execute(input: Input, context: AgentContext): Promise<Output>;
}

export interface AgentContext {
  llmClient: LLMClient;
  exaClient?: ExaClient;
  wikiStore: WikiStore;
  dbConnection: DatabaseConnection;
  emitReasoning?: (chunk: string) => void;
}

// ---------------------------------------------------------------------------
// Placeholder client / store interfaces
// ---------------------------------------------------------------------------

export interface LLMClient {
  complete(prompt: string, systemPrompt?: string): Promise<string>;
  completeStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    systemPrompt?: string
  ): Promise<T>;
}

export interface ExaClient {
  search(params: ExaSearchParams): Promise<ExaSearchResult>;
  getContents(urls: string[]): Promise<ExaContentResult>;
}

export interface ExaSearchParams {
  query: string;
  type?: "auto" | "instant" | "fast" | "deep-lite" | "deep" | "deep-reasoning";
  useAutoprompt?: boolean;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  category?: string;
  highlights?: boolean | { numSentences?: number; highlightsPerUrl?: number };
  text?: boolean | { maxCharacters?: number };
}

export interface ExaSearchResult {
  results: Array<{
    id: string;
    title: string;
    url: string;
    publishedDate?: string;
    author?: string;
    score?: number;
    text?: string;
    highlights?: string[];
  }>;
}

export interface ExaContentResult {
  contents: Array<{
    id: string;
    url: string;
    title?: string;
    author?: string;
    publishedDate?: string;
    text: string;
  }>;
}

export interface WikiStore {
  readPage(kbName: string, pagePath: string): Promise<string | null>;
  writePage(kbName: string, pagePath: string, content: string): Promise<void>;
  listPages(kbName: string): Promise<string[]>;
  deletePage(kbName: string, pagePath: string): Promise<void>;
}

export interface DatabaseConnection {
  query(sql: string, params?: unknown[]): unknown[];
  exec(sql: string): void;
  prepare(sql: string): unknown;
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface IngestionJob {
  id: number;
  status: "pending" | "profiling" | "planning" | "awaiting_approval" | "writing" | "complete" | "error";
  filename: string;
  schemaJson: string;
  planJson?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Investigation state types (for LangGraph)
// ---------------------------------------------------------------------------

export interface SubClaim {
  id: string;
  claimText: string;
  targetEntityType: string;
}

export interface ResearchPlan {
  tip: string;
  subClaims: SubClaim[];
}

export interface EvidenceBundle {
  subClaimId: string;
  sourceType: "sqlite" | "exa";
  query: string;
  results: unknown[];
  timestamp: string;
}

export interface Synthesis {
  subClaimId: string;
  claimText?: string;
  narrative: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  contradictions: string[];
  sources?: Array<{
    sourceType: "sqlite" | "exa";
    link: string;
    description: string;
  }>;
}

export interface Dossier {
  executiveSummary: string;
  findings: Synthesis[];
  connections: ConnectionFinding[];
  gaps: string[];
  overallConfidence: "HIGH" | "MEDIUM" | "LOW";
  sourceAttribution: SourceAttribution[];
  suggestedNextSteps: string[];
}

export interface ConnectionFinding {
  entityIdentifier: string;
  sources: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  notes: string;
}

export interface SourceAttribution {
  claim: string;
  sourceType: "sqlite" | "exa";
  sourceDetail: string;
}

export interface KBAssignment {
  subClaimId: string;
  kbName: string;
  sourceType: "sqlite" | "exa";
  relevanceScore: number;
  justification: string;
}

export interface SqlQuery {
  type: "sql";
  subClaimId: string;
  kbName: string;
  description: string;
  sql: string;
}

export interface ExaQuery {
  type: "exa";
  subClaimId: string;
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  category?: string;
}

export type Query = SqlQuery | ExaQuery;

export interface InvestigationState {
  id?: string;
  tip: string;
  round: number;
  maxRounds: number;
  researchPlan: ResearchPlan;
  kbAssignments: KBAssignment[];
  queries: Query[];
  evidence: EvidenceBundle[];
  synthesis: Synthesis[];
  connections: ConnectionFinding[];
  dossier?: Dossier;
  rawEvidence?: EvidenceBundle[];
  auditDecision?: "CONTINUE" | "STOP_COMPLETE" | "STOP_WITH_GAPS";
  error?: string;
}

// SSE event types for real-time agent monitoring
export interface StageEvent {
  type: "stage_start" | "stage_complete" | "error" | "query_executed";
  stage: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface ReasoningChunkEvent {
  type: "reasoning";
  stage: string;
  chunk: string;
  timestamp: string;
}

export interface QueryExecutedEvent {
  type: "query_executed";
  stage: "executor";
  timestamp: string;
  payload: {
    subClaimId: string;
    sourceType: "sqlite" | "exa";
    query: string;
    resultCount: number;
    durationMs?: number;
  };
}

// ---------------------------------------------------------------------------
// Wiki types
// ---------------------------------------------------------------------------

export interface WikiPage {
  kbName: string;
  pagePath: string;
  content: string;
  lastModified: string;
}

export interface ColumnSchema {
  name: string;
  type: "TEXT" | "INTEGER" | "REAL" | "DATE";
  nullable: boolean;
  sampleValues: unknown[];
}

export interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
  foreignKeys: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

export interface ProfilingQuery {
  description: string;
  sql: string;
}

export interface ProfilingResult {
  query: ProfilingQuery;
  result: unknown[];
}

export interface ProposedWikiPage {
  path: string;
  title: string;
  rationale: string;
}

export interface WikiPlan {
  indexContent: string;
  proposedPages: ProposedWikiPage[];
  linkageHints: string[];
}
