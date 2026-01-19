/**
 * Broken Link Report Panel
 * Shows dead links, stale nodes, and health metrics
 */

import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VoidNode, VoidEdge } from "../lib/types";
import {
  generateBrokenLinkReport,
  calculateCrawlStatistics,
  BrokenLinkReport,
  CrawlStatistics,
} from "../lib/crawlAnalytics";

interface BrokenLinkPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: VoidNode[];
  edges: VoidEdge[];
  onTeleport: (node: VoidNode) => void;
  onDeleteNodes: (nodes: VoidNode[]) => void;
  onRecrawl: (nodeId: number) => void;
}

export function BrokenLinkPanel({
  isOpen,
  onClose,
  nodes,
  edges,
  onTeleport,
  onDeleteNodes,
  onRecrawl,
}: BrokenLinkPanelProps) {
  const [activeTab, setActiveTab] = useState<"dead" | "stale" | "stats">("dead");
  const [selectedNodes, setSelectedNodes] = useState<Set<number>>(new Set());
  const [isRecrawling, setIsRecrawling] = useState<number | null>(null);

  // Generate reports
  const report = useMemo(() => generateBrokenLinkReport(nodes, 7), [nodes]);
  const stats = useMemo(() => {
    const rootNode = nodes.find(n => n.is_alive);
    return calculateCrawlStatistics(nodes, edges, rootNode?.id);
  }, [nodes, edges]);

  // Reset selection when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedNodes(new Set());
    }
  }, [isOpen]);

  const handleRecrawl = async (nodeId: number) => {
    setIsRecrawling(nodeId);
    try {
      await invoke("crawl_single_node", { nodeId });
      onRecrawl(nodeId);
    } catch (err) {
      console.error("Recrawl failed:", err);
    } finally {
      setIsRecrawling(null);
    }
  };

  const handleDeleteSelected = () => {
    const nodesToDelete = nodes.filter(n => selectedNodes.has(n.id));
    if (nodesToDelete.length > 0) {
      onDeleteNodes(nodesToDelete);
      setSelectedNodes(new Set());
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = (list: { id: number }[]) => {
    setSelectedNodes(new Set(list.map(n => n.id)));
  };

  if (!isOpen) return null;

  const getHealthColor = (score: number) => {
    if (score >= 80) return "#4caf50";
    if (score >= 60) return "#8bc34a";
    if (score >= 40) return "#ffc107";
    if (score >= 20) return "#ff9800";
    return "#f44336";
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          width: 700,
          maxWidth: "95vw",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 60px rgba(79, 195, 247, 0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(79, 195, 247, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 20,
            }}
          >
            🔗 Link Health Report
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#4fc3f7",
              fontSize: 24,
              cursor: "pointer",
              opacity: 0.7,
            }}
          >
            ×
          </button>
        </div>

        {/* Summary Stats */}
        <div
          style={{
            padding: "16px 24px",
            background: "rgba(79, 195, 247, 0.05)",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 16,
            borderBottom: "1px solid rgba(79, 195, 247, 0.1)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#4fc3f7", fontSize: 24, fontWeight: "bold" }}>
              {report.totalNodes}
            </div>
            <div style={{ color: "rgba(79, 195, 247, 0.6)", fontSize: 11, fontFamily: "monospace" }}>
              Total Nodes
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#4caf50", fontSize: 24, fontWeight: "bold" }}>
              {report.aliveNodes}
            </div>
            <div style={{ color: "rgba(79, 195, 247, 0.6)", fontSize: 11, fontFamily: "monospace" }}>
              Alive
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f44336", fontSize: 24, fontWeight: "bold" }}>
              {report.deadNodes}
            </div>
            <div style={{ color: "rgba(79, 195, 247, 0.6)", fontSize: 11, fontFamily: "monospace" }}>
              Dead Links
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#ff9800", fontSize: 24, fontWeight: "bold" }}>
              {report.staleNodes}
            </div>
            <div style={{ color: "rgba(79, 195, 247, 0.6)", fontSize: 11, fontFamily: "monospace" }}>
              Stale (7d+)
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                color: getHealthColor(stats.healthScore),
                fontSize: 24,
                fontWeight: "bold",
              }}
            >
              {stats.healthScore}%
            </div>
            <div style={{ color: "rgba(79, 195, 247, 0.6)", fontSize: 11, fontFamily: "monospace" }}>
              Health Score
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(79, 195, 247, 0.2)",
          }}
        >
          {[
            { id: "dead" as const, label: `Dead Links (${report.deadNodes})`, icon: "💀" },
            { id: "stale" as const, label: `Stale Nodes (${report.staleNodes})`, icon: "⏰" },
            { id: "stats" as const, label: "Statistics", icon: "📊" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: activeTab === tab.id ? "rgba(79, 195, 247, 0.15)" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #4fc3f7" : "2px solid transparent",
                color: activeTab === tab.id ? "#4fc3f7" : "rgba(79, 195, 247, 0.6)",
                fontFamily: "monospace",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {activeTab === "dead" && (
            <>
              {report.deadNodeList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "rgba(79, 195, 247, 0.5)",
                    fontFamily: "monospace",
                  }}
                >
                  🎉 No dead links found!
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
                    <button
                      onClick={() => selectAll(report.deadNodeList)}
                      style={{
                        padding: "6px 12px",
                        background: "rgba(79, 195, 247, 0.1)",
                        border: "1px solid rgba(79, 195, 247, 0.3)",
                        borderRadius: 4,
                        color: "#4fc3f7",
                        fontFamily: "monospace",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Select All
                    </button>
                    {selectedNodes.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        style={{
                          padding: "6px 12px",
                          background: "rgba(244, 67, 54, 0.2)",
                          border: "1px solid #f44336",
                          borderRadius: 4,
                          color: "#f44336",
                          fontFamily: "monospace",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Delete Selected ({selectedNodes.size})
                      </button>
                    )}
                  </div>
                  {report.deadNodeList.map((node) => (
                    <NodeRow
                      key={node.id}
                      node={node}
                      isSelected={selectedNodes.has(node.id)}
                      onToggleSelect={() => toggleSelect(node.id)}
                      onTeleport={() => {
                        const voidNode = nodes.find(n => n.id === node.id);
                        if (voidNode) onTeleport(voidNode);
                      }}
                      onRecrawl={() => handleRecrawl(node.id)}
                      isRecrawling={isRecrawling === node.id}
                      status="dead"
                    />
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === "stale" && (
            <>
              {report.staleNodeList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "rgba(79, 195, 247, 0.5)",
                    fontFamily: "monospace",
                  }}
                >
                  ✨ All nodes are fresh!
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
                    <button
                      onClick={() => selectAll(report.staleNodeList)}
                      style={{
                        padding: "6px 12px",
                        background: "rgba(79, 195, 247, 0.1)",
                        border: "1px solid rgba(79, 195, 247, 0.3)",
                        borderRadius: 4,
                        color: "#4fc3f7",
                        fontFamily: "monospace",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Select All
                    </button>
                  </div>
                  {report.staleNodeList.map((node) => (
                    <NodeRow
                      key={node.id}
                      node={node}
                      isSelected={selectedNodes.has(node.id)}
                      onToggleSelect={() => toggleSelect(node.id)}
                      onTeleport={() => {
                        const voidNode = nodes.find(n => n.id === node.id);
                        if (voidNode) onTeleport(voidNode);
                      }}
                      onRecrawl={() => handleRecrawl(node.id)}
                      isRecrawling={isRecrawling === node.id}
                      status="stale"
                    />
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === "stats" && (
            <div style={{ display: "grid", gap: 16 }}>
              {/* Coverage */}
              <StatCard title="Crawl Coverage" value={`${stats.crawlCoverage}%`}>
                <div
                  style={{
                    height: 8,
                    background: "rgba(79, 195, 247, 0.2)",
                    borderRadius: 4,
                    overflow: "hidden",
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${stats.crawlCoverage}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #4fc3f7, #00e5ff)",
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                  {stats.crawledNodes} of {stats.totalNodes} nodes crawled
                </div>
              </StatCard>

              {/* Recent Activity */}
              <StatCard title="Recent Activity">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 8 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: "bold", color: "#4caf50" }}>
                      {stats.recentActivity.last24h}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>Last 24h</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: "bold", color: "#8bc34a" }}>
                      {stats.recentActivity.last7d}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>Last 7 days</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: "bold", color: "#ffc107" }}>
                      {stats.recentActivity.last30d}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>Last 30 days</div>
                  </div>
                </div>
              </StatCard>

              {/* Depth Stats */}
              <StatCard title="Graph Depth">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Average Depth</div>
                    <div style={{ fontSize: 18, fontWeight: "bold" }}>{stats.avgDepth}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Max Depth</div>
                    <div style={{ fontSize: 18, fontWeight: "bold" }}>{stats.maxDepth}</div>
                  </div>
                </div>
              </StatCard>

              {/* Top Domains */}
              <StatCard title="Top Domains">
                <div style={{ marginTop: 8 }}>
                  {Array.from(stats.domainDistribution.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([domain, count]) => (
                      <div
                        key={domain}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          borderBottom: "1px solid rgba(79, 195, 247, 0.1)",
                        }}
                      >
                        <span style={{ fontSize: 12 }}>{domain}</span>
                        <span style={{ fontSize: 12, opacity: 0.6 }}>{count}</span>
                      </div>
                    ))}
                </div>
              </StatCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function NodeRow({
  node,
  isSelected,
  onToggleSelect,
  onTeleport,
  onRecrawl,
  isRecrawling,
  status,
}: {
  node: { id: number; url: string; title: string; daysSinceCheck: number | null };
  isSelected: boolean;
  onToggleSelect: () => void;
  onTeleport: () => void;
  onRecrawl: () => void;
  isRecrawling: boolean;
  status: "dead" | "stale";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: isSelected ? "rgba(79, 195, 247, 0.15)" : "rgba(79, 195, 247, 0.05)",
        borderRadius: 6,
        marginBottom: 8,
        border: `1px solid ${isSelected ? "#4fc3f7" : "rgba(79, 195, 247, 0.1)"}`,
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        style={{ width: 16, height: 16 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.title || node.url}
        </div>
        <div
          style={{
            color: "rgba(79, 195, 247, 0.5)",
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.url}
        </div>
      </div>
      <div
        style={{
          color: status === "dead" ? "#f44336" : "#ff9800",
          fontFamily: "monospace",
          fontSize: 11,
          whiteSpace: "nowrap",
        }}
      >
        {node.daysSinceCheck !== null ? `${node.daysSinceCheck}d ago` : "Never"}
      </div>
      <button
        onClick={onTeleport}
        title="Teleport to node"
        style={{
          padding: "4px 8px",
          background: "rgba(79, 195, 247, 0.1)",
          border: "1px solid rgba(79, 195, 247, 0.3)",
          borderRadius: 4,
          color: "#4fc3f7",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        📍
      </button>
      <button
        onClick={onRecrawl}
        disabled={isRecrawling}
        title="Recrawl node"
        style={{
          padding: "4px 8px",
          background: "rgba(79, 195, 247, 0.1)",
          border: "1px solid rgba(79, 195, 247, 0.3)",
          borderRadius: 4,
          color: "#4fc3f7",
          fontSize: 12,
          cursor: isRecrawling ? "wait" : "pointer",
          opacity: isRecrawling ? 0.5 : 1,
        }}
      >
        {isRecrawling ? "..." : "🔄"}
      </button>
    </div>
  );
}

function StatCard({
  title,
  value,
  children,
}: {
  title: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(79, 195, 247, 0.05)",
        border: "1px solid rgba(79, 195, 247, 0.2)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 13, opacity: 0.8 }}>
          {title}
        </div>
        {value && (
          <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 20, fontWeight: "bold" }}>
            {value}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
