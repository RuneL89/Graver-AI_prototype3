import { useState } from "react";
import {
  Hammer,
  Compass,
  Zap,
  Search,
  Link,
  Puzzle,
  ClipboardCheck,
  RefreshCw,
  Folder,
  FileText,
  ChevronDown,
  ChevronUp,
  Bot,
  BarChart3,
  PenTool,
  Layout,
} from "lucide-react";

interface Skill {
  name: string;
  description: string;
}

interface Agent {
  id: string;
  label: string;
  description: string;
  prompt: string;
  skills: Skill[];
  Icon: React.FC<{ className?: string }>;
  color: string;
}

export const investigationAgents: Agent[] = [
  {
    id: "decomposer",
    label: "Tip Decomposer",
    description:
      "Breaks an investigative tip into 3–5 independently researchable sub-claims, each with a focused research question, target entity type, and suggested knowledge bases.",
    prompt:
      "You are an investigative research planner. Given the following tip and available knowledge bases, break the tip into 3-5 independently researchable sub-claims.",
    skills: [
      {
        name: "tipDecomposer",
        description:
          "Decomposes a tip into sub-claims with entity types and suggested KBs.",
      },
    ],
    Icon: Hammer,
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "navigator",
    label: "KB Navigator",
    description:
      "Matches each sub-claim to the most relevant knowledge bases, returning ranked assignments with relevance scores and justifications.",
    prompt:
      "You are a knowledge base navigator. Given a research sub-claim and available knowledge base indexes, decide which knowledge bases are most relevant.",
    skills: [
      {
        name: "kbNavigator",
        description:
          "Assigns KBs to sub-claims with relevance scores and justifications.",
      },
    ],
    Icon: Compass,
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    id: "generator",
    label: "Query Generator",
    description:
      "Generates precise queries for each sub-claim: SQL SELECT statements for SQLite KBs, or structured search parameters for Exa.ai web research.",
    prompt:
      "You are a query generation specialist. Given a research sub-claim and assigned knowledge bases, generate precise queries.",
    skills: [
      {
        name: "queryGenerator",
        description:
          "Generates SQL or Exa search queries tailored to each sub-claim and KB schema.",
      },
    ],
    Icon: Zap,
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    id: "executor",
    label: "Query Executor",
    description:
      "Executes generated queries in parallel against real data sources. Validates SQL safety (SELECT-only), runs SQLite queries, and calls Exa.ai search. Collects results into evidence bundles.",
    prompt:
      "No LLM prompt — this agent is a deterministic execution engine that runs queries against SQLite and Exa.ai and returns raw evidence bundles.",
    skills: [
      {
        name: "executeQueries",
        description:
          "Validates and executes SQL/Exa queries in parallel, wrapping results into evidence bundles with timing metadata.",
      },
    ],
    Icon: Search,
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    id: "resolver",
    label: "Entity Resolver",
    description:
      "Finds shared identifiers across result sets from multiple knowledge bases, flags potential matches, aliases, and cross-references. Notes contradictions between sources.",
    prompt:
      "You are an entity resolution specialist. Given the following evidence from multiple knowledge bases and web search, identify shared identifiers, potential matches, aliases, and cross-references.",
    skills: [
      {
        name: "entityResolver",
        description:
          "Resolves entities across sources, finds aliases, and flags contradictions.",
      },
    ],
    Icon: Link,
    color: "bg-pink-100 text-pink-800 border-pink-200",
  },
  {
    id: "synthesizer",
    label: "Evidence Synthesizer",
    description:
      "Assembles evidence into narrative summaries per sub-claim, assigning HIGH / MEDIUM / LOW confidence ratings and flagging contradictions.",
    prompt:
      "You are an evidence synthesis specialist. Given evidence from multiple sources and cross-source connections, assemble a narrative summary per sub-claim.",
    skills: [
      {
        name: "evidenceSynthesizer",
        description:
          "Synthesizes evidence into narrative summaries with confidence ratings.",
      },
    ],
    Icon: Puzzle,
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  {
    id: "auditor",
    label: "Gap Auditor",
    description:
      "Evaluates the cumulative investigation state and decides whether to CONTINUE for another round, STOP as complete, or STOP WITH GAPS.",
    prompt:
      "You are an investigation gap auditor. Evaluate whether the investigation should continue, stop as complete, or stop with gaps.",
    skills: [
      {
        name: "gapAuditor",
        description:
          "Audits investigation coverage and decides: CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS.",
      },
    ],
    Icon: ClipboardCheck,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    id: "incrementRound",
    label: "Round Controller",
    description:
      "Simple state transition that increments the investigation round counter and routes back to the KB Navigator for the next iteration. Maximum 5 rounds.",
    prompt:
      "No LLM prompt — this is a deterministic control-flow node that increments the round counter and loops back to the navigator.",
    skills: [
      {
        name: "incrementRound",
        description:
          "Deterministically increments round and routes the graph back to the navigator node.",
      },
    ],
    Icon: RefreshCw,
    color: "bg-gray-100 text-gray-800 border-gray-200",
  },
  {
    id: "assembler",
    label: "Dossier Assembler",
    description:
      "Formats a structured investigation dossier with executive summary, findings per sub-claim, connections, gaps, overall confidence, source attribution, and suggested next steps. If gaps exist, runs gap discovery first.",
    prompt:
      "You are a dossier assembler. Format the investigation results into a structured dossier.",
    skills: [
      {
        name: "dossierAssembler",
        description:
          "Assembles the final dossier: summary, findings, connections, gaps, confidence, attribution.",
      },
      {
        name: "gapDiscovery",
        description:
          "Suggests what data is missing, what type of KB would contain it, and what public sources might exist.",
      },
    ],
    Icon: Folder,
    color: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  {
    id: "writeback",
    label: "Wiki Writeback",
    description:
      "Files investigation results as new findings pages in the wiki and updates knowledge base index pages with cross-KB connection notes.",
    prompt:
      "No LLM prompt — this agent programmatically builds Markdown content and writes pages to the wiki store.",
    skills: [
      {
        name: "wikiWriteback",
        description:
          "Writes investigation findings as markdown wiki pages and updates KB indexes with connection notes.",
      },
    ],
    Icon: FileText,
    color: "bg-teal-100 text-teal-800 border-teal-200",
  },
];

export const ingestionAgents: Agent[] = [
  {
    id: "profiler",
    label: "Statistical Profiler",
    description:
      "Analyzes the uploaded dataset schema and generates lightweight SQL aggregate queries to understand data cardinality, null rates, ranges, and distributions.",
    prompt:
      "You are a data profiling assistant for large-scale SQLite datasets. Given a table schema and sample rows, propose 5-8 lightweight SQL SELECT queries that efficiently measure the data landscape.",
    skills: [
      {
        name: "statisticalProfiler",
        description:
          "Generates O(n) single-pass aggregate queries (COUNT DISTINCT, MIN/MAX/AVG, null percentages) avoiding ORDER BY, SELECT *, and high-cardinality GROUP BY.",
      },
    ],
    Icon: BarChart3,
    color: "bg-sky-100 text-sky-800 border-sky-200",
  },
  {
    id: "architect",
    label: "Wiki Architect",
    description:
      "Designs a wiki structure plan from profiling results: drafting index.md, proposing 3-6 entity/segment pages, and suggesting cross-KB linkage hints.",
    prompt:
      "You are a wiki architect. Given database table schema and statistical profiling results, design a markdown wiki structure plan.",
    skills: [
      {
        name: "wikiArchitect",
        description:
          "Drafts index.md content, proposes entity/segment pages with rationale, and suggests cross-knowledge-base linkage hints.",
      },
    ],
    Icon: Layout,
    color: "bg-violet-100 text-violet-800 border-violet-200",
  },
  {
    id: "writer",
    label: "Wiki Writer",
    description:
      "Generates polished markdown wiki pages from an approved plan and statistical results, including wikilinks, citation anchors, and merged index content.",
    prompt:
      "You are a wiki writer. Generate polished markdown pages for a knowledge base based on the approved plan and statistical results.",
    skills: [
      {
        name: "wikiWriter",
        description:
          "Writes index.md and entity pages with proper headers, wikilinks, citation anchors, and factual grounding in profiling results.",
      },
    ],
    Icon: FileText,
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    id: "modifier",
    label: "Plan Modifier",
    description:
      "Revises an existing wiki plan based on user feedback while preserving statistical grounding from the original profiling results.",
    prompt:
      "You are a wiki architect. A user has reviewed your initial wiki plan and requested changes. Revise the plan accordingly.",
    skills: [
      {
        name: "wikiPlanModifier",
        description:
          "Adds, removes, or restructures pages; changes index.md; modifies linkage hints; merges KBs — all while preserving statistical grounding.",
      },
    ],
    Icon: PenTool,
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
];

interface AgentInventoryProps {
  agents?: Agent[];
}

export default function AgentInventory({ agents = investigationAgents }: AgentInventoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Bot className="w-4 h-4 text-slate-600" />
        <h3 className="font-semibold text-sm">Agent Inventory</h3>
      </div>
      <div className="divide-y">
        {agents.map((agent) => {
          const expanded = expandedId === agent.id;
          return (
            <div key={agent.id} className="p-3">
              <button
                onClick={() => toggle(agent.id)}
                className="w-full flex items-center gap-2 text-left"
              >
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded border ${agent.color}`}
                >
                  <agent.Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-sm font-medium flex-1">{agent.label}</span>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expanded && (
                <div className="mt-3 space-y-3 pl-9">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {agent.description}
                  </p>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Prompt
                    </h4>
                    <div className="bg-gray-50 border rounded p-2.5">
                      <p className="text-xs text-gray-700 font-mono leading-relaxed">
                        {agent.prompt}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Skills
                    </h4>
                    <div className="space-y-2">
                      {agent.skills.map((skill) => (
                        <div
                          key={skill.name}
                          className="bg-slate-50 border border-slate-100 rounded px-3 py-2"
                        >
                          <p className="text-xs font-medium text-slate-800">
                            {skill.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {skill.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
