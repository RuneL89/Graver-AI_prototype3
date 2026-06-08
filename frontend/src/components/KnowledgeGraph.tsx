import { useMemo, useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import type { Dossier, EvidenceBundle } from "@graver-ai/shared";

interface Props {
  dossier: Dossier;
  tip?: string;
  rawEvidence?: EvidenceBundle[];
  onSourceClick?: (source: {
    sourceType: "sqlite" | "exa";
    query: string;
    results: unknown[];
    link: string;
  }) => void;
}

type NodeType = "tip" | "subClaim" | "source" | "entity";

interface NodeData {
  label: string;
  type: NodeType;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  tooltip?: string;
  sourceType?: "sqlite" | "exa";
  link?: string;
  query?: string;
  results?: unknown[];
}

const SUBCLAIM_RADIUS = 300;
const SOURCE_RADIUS = 140;
const ENTITY_RADIUS = 600;

function NodeTooltip({ text }: { text: string }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
      <div className="bg-slate-800 text-white text-xs rounded px-3 py-2 max-w-xs whitespace-pre-wrap shadow-lg">
        {text}
      </div>
    </div>
  );
}

function TipNode({ data }: { data: NodeData }) {
  return (
    <div className="group relative cursor-pointer">
      <NodeTooltip text={data.tooltip || data.label} />
      <div className="bg-slate-800 text-white rounded-full px-5 py-4 shadow-lg max-w-[260px] border-4 border-white">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1 text-center">Tip</div>
        <div className="text-sm font-medium leading-snug text-center">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  );
}

function SubClaimNode({ data }: { data: NodeData }) {
  const colorClass =
    data.confidence === "HIGH"
      ? "bg-green-100 text-green-700 border-green-300"
      : data.confidence === "MEDIUM"
      ? "bg-amber-100 text-amber-700 border-amber-300"
      : "bg-red-100 text-red-700 border-red-300";

  return (
    <div className="group relative cursor-pointer">
      <NodeTooltip text={data.tooltip || data.label} />
      <div className={`rounded-xl px-3 py-2 border-2 shadow-md max-w-[220px] ${colorClass}`}>
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Sub-Claim</div>
        <div className="text-xs font-medium leading-snug">{data.label}</div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  );
}

function SourceNode({ data }: { data: NodeData }) {
  const isExa = data.sourceType === "exa";
  return (
    <div className="group relative cursor-pointer">
      <NodeTooltip text={data.tooltip || data.label} />
      <div
        className={`rounded-full px-3 py-1.5 shadow-sm max-w-[180px] border text-center ${
          isExa
            ? "bg-purple-50 text-purple-700 border-purple-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}
      >
        <div className="text-[9px] font-bold uppercase tracking-wider opacity-60 mb-0.5">
          {isExa ? "Exa" : "SQLite"}
        </div>
        <div className="text-[11px] font-medium leading-snug truncate">{data.label}</div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <Handle type="target" position={Position.Right} className="!bg-slate-400" />
    </div>
  );
}

function EntityNode({ data }: { data: NodeData }) {
  const colorClass =
    data.confidence === "HIGH"
      ? "bg-green-100 text-green-700 border-green-300"
      : data.confidence === "MEDIUM"
      ? "bg-amber-100 text-amber-700 border-amber-300"
      : "bg-red-100 text-red-700 border-red-300";

  return (
    <div className="group relative cursor-pointer">
      <NodeTooltip text={data.tooltip || data.label} />
      <div className={`rounded-lg px-3 py-2 border-2 shadow-md max-w-[220px] ${colorClass}`}>
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Entity</div>
        <div className="text-xs font-medium leading-snug">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Left} className="!bg-slate-400" />
    </div>
  );
}

const nodeTypes = {
  tip: TipNode,
  subClaim: SubClaimNode,
  source: SourceNode,
  entity: EntityNode,
};

function findEvidenceForSource(
  subClaimId: string,
  source: NonNullable<Dossier["findings"][number]["sources"]>[number],
  rawEvidence: EvidenceBundle[] | undefined,
  typeCounters: Map<string, number>
): EvidenceBundle | undefined {
  if (!rawEvidence) return undefined;
  const matches = rawEvidence.filter(
    (e) => e.subClaimId === subClaimId && e.sourceType === source.sourceType
  );
  const key = `${subClaimId}:${source.sourceType}`;
  const idx = typeCounters.get(key) ?? 0;
  typeCounters.set(key, idx + 1);
  return matches[idx];
}

function buildNodesAndEdges(
  dossier: Dossier,
  tip?: string,
  rawEvidence?: EvidenceBundle[]
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  // --- Tip node (center) ---
  const tipLabel = tip
    ? tip.slice(0, 120) + (tip.length > 120 ? "..." : "")
    : dossier.executiveSummary.slice(0, 120) + (dossier.executiveSummary.length > 120 ? "..." : "");

  nodes.push({
    id: "tip",
    type: "tip",
    position: { x: 0, y: 0 },
    data: {
      label: tipLabel,
      type: "tip",
      tooltip: tip || dossier.executiveSummary,
    },
  });

  const subClaimCount = dossier.findings.length;
  const entityCount = dossier.connections.length;

  // --- Sub-claim nodes on inner circle ---
  dossier.findings.forEach((f, i) => {
    const angle = (2 * Math.PI * i) / Math.max(subClaimCount, 1) - Math.PI / 2;
    const x = Math.cos(angle) * SUBCLAIM_RADIUS;
    const y = Math.sin(angle) * SUBCLAIM_RADIUS;
    const id = `subclaim-${f.subClaimId}`;

    nodes.push({
      id,
      type: "subClaim",
      position: { x, y },
      data: {
        label: f.claimText || f.subClaimId,
        type: "subClaim",
        confidence: f.confidence,
        tooltip: f.narrative,
      },
    });

    edges.push({
      id: `edge-tip-${id}`,
      source: "tip",
      target: id,
      animated: false,
      style: { stroke: "#64748b", strokeWidth: 2.5 },
    });

    // --- Source nodes orbiting this sub-claim ---
    if (f.sources && f.sources.length > 0) {
      const typeCounters = new Map<string, number>();
      f.sources.forEach((s, j) => {
        const evidence = findEvidenceForSource(f.subClaimId, s, rawEvidence, typeCounters);
        const sourceCount = f.sources!.length;
        const spread = Math.min(Math.PI * 0.8, sourceCount * 0.5);
        const sourceAngle = angle + (j - (sourceCount - 1) / 2) * (spread / Math.max(sourceCount - 1, 1));
        const sx = x + Math.cos(sourceAngle) * SOURCE_RADIUS;
        const sy = y + Math.sin(sourceAngle) * SOURCE_RADIUS;
        const sourceId = `source-${f.subClaimId}-${j}`;

        nodes.push({
          id: sourceId,
          type: "source",
          position: { x: sx, y: sy },
          data: {
            label: s.link,
            type: "source",
            tooltip: s.description,
            sourceType: s.sourceType,
            link: s.link,
            query: evidence?.query,
            results: evidence?.results,
          },
        });

        edges.push({
          id: `edge-${id}-${sourceId}`,
          source: id,
          target: sourceId,
          animated: false,
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        });
      });
    }
  });

  // --- Entity nodes on outer ring ---
  dossier.connections.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / Math.max(entityCount, 1) - Math.PI / 2;
    const x = Math.cos(angle) * ENTITY_RADIUS;
    const y = Math.sin(angle) * ENTITY_RADIUS;
    const id = `entity-${i}`;

    nodes.push({
      id,
      type: "entity",
      position: { x, y },
      data: {
        label: c.entityIdentifier,
        type: "entity",
        confidence: c.confidence,
        tooltip: c.notes,
      },
    });

    // Connect entity to matching source nodes (by substring match)
    c.sources.forEach((srcStr) => {
      const matches = nodes.filter(
        (n) =>
          n.data.type === "source" &&
          (n.data.link?.toLowerCase().includes(srcStr.toLowerCase()) ||
            srcStr.toLowerCase().includes(n.data.link?.toLowerCase() || ""))
      );

      if (matches.length > 0) {
        matches.forEach((match) => {
          edges.push({
            id: `edge-${id}-${match.id}`,
            source: id,
            target: match.id,
            animated: false,
            style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          });
        });
      } else {
        // Dangling source
        const danglingId = `source-dangling-${i}-${srcStr}`;
        nodes.push({
          id: danglingId,
          type: "source",
          position: { x: x * 0.75, y: y + 40 },
          data: {
            label: srcStr,
            type: "source",
            tooltip: `Source: ${srcStr}`,
          },
        });
        edges.push({
          id: `edge-${id}-${danglingId}`,
          source: id,
          target: danglingId,
          animated: false,
          style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
        });
      }
    });
  });

  return { nodes, edges };
}

export default function KnowledgeGraph({
  dossier,
  tip,
  rawEvidence,
  onSourceClick,
}: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => buildNodesAndEdges(dossier, tip, rawEvidence),
    [dossier, tip, rawEvidence]
  );

  const { nodes, edges } = useMemo(() => {
    if (!selectedNodeId) {
      return {
        nodes: baseNodes.map((n: Node<NodeData>) => ({ ...n, style: { opacity: 1 } })),
        edges: baseEdges.map((e: Edge) => ({
          ...e,
          style: { ...e.style, opacity: 1 },
        })),
      };
    }

    const connected = new Set<string>([selectedNodeId]);
    for (const edge of baseEdges) {
      if (edge.source === selectedNodeId) connected.add(edge.target);
      if (edge.target === selectedNodeId) connected.add(edge.source);
    }

    const styledNodes = baseNodes.map((n: Node<NodeData>) => ({
      ...n,
      style: {
        opacity: connected.has(n.id) ? 1 : 0.2,
        transition: "opacity 200ms ease",
      },
    }));

    const styledEdges = baseEdges.map((e: Edge) => ({
      ...e,
      style: {
        ...e.style,
        opacity:
          e.source === selectedNodeId || e.target === selectedNodeId ? 1 : 0.1,
        transition: "opacity 200ms ease",
      },
    }));

    return { nodes: styledNodes, edges: styledEdges };
  }, [baseNodes, baseEdges, selectedNodeId]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<NodeData>) => {
      setSelectedNodeId(node.id);

      if (node.data.type === "source" && onSourceClick) {
        const { sourceType, link, query, results } = node.data;
        if (sourceType === "exa" && link) {
          if (link.startsWith("http")) {
            window.open(link, "_blank", "noopener,noreferrer");
          }
        } else if (sourceType === "sqlite") {
          if (query) {
            onSourceClick({
              sourceType: "sqlite",
              query,
              results: results || [],
              link: link || "",
            });
          } else {
            window.alert("Query results not available for this source. Re-run the investigation to capture evidence details.");
          }
        }
      }
    },
    [onSourceClick]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={1.5}
      >
        <Background color="#cbd5e1" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
