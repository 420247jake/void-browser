/**
 * Stats Dashboard Panel
 * Shows analytics, domain breakdown, and dead link management
 */

import { useEffect, useState, useMemo } from "react";
import { VoidNode, VoidEdge } from "../lib/types";
import {
  calculateGraphStats,
  calculateDomainStats,
  calculateTimeline,
  getDeadLinks,
  getCrawlActivity,
  GraphStats,
  DomainStats,
  TimelinePoint,
  DeadLink,
} from "../lib/analytics";

interface StatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: VoidNode[];
  edges: VoidEdge[];
  onTeleport: (node: VoidNode) => void;
  onDeleteNodes: (nodes: VoidNode[]) => void;
  onFilterDomain: (domain: string | null) => void;
}

// Tab type
type TabId = "overview" | "domains" | "timeline" | "deadlinks";

export function StatsPanel({
  isOpen,
  onClose,
  nodes,
  edges,
  onTeleport,
  onDeleteNodes,
  onFilterDomain,
}: StatsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedDeadLinks, setSelectedDeadLinks] = useState<Set<number>>(new Set());

  // Calculate stats (memoized)
  const graphStats = useMemo(() => calculateGraphStats(nodes, edges), [nodes, edges]);
  const domainStats = useMemo(() => calculateDomainStats(nodes), [nodes]);
  const timeline = useMemo(() => calculateTimeline(nodes), [nodes]);
  const deadLinks = useMemo(() => getDeadLinks(nodes), [nodes]);
  const crawlActivity = useMemo(() => getCrawlActivity(nodes), [nodes]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "1") {
        setActiveTab("overview");
      } else if (e.key === "2") {
        setActiveTab("domains");
      } else if (e.key === "3") {
        setActiveTab("timeline");
      } else if (e.key === "4") {
        setActiveTab("deadlinks");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Clear selection when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedDeadLinks(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "domains", label: "Domains", icon: "🌐" },
    { id: "timeline", label: "Timeline", icon: "📅" },
    { id: "deadlinks", label: "Dead Links", icon: "💀" },
  ];

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
        backdropFilter: "blur(10px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 900,
          maxHeight: "85vh",
          background: "rgba(10, 10, 30, 0.98)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          boxShadow: "0 0 60px rgba(79, 195, 247, 0.3)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(79, 195, 247, 0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>📈</span>
            <span
              style={{
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 18,
                fontWeight: "bold",
              }}
            >
              VOID ANALYTICS
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              color: "#4fc3f7",
              padding: "6px 12px",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            ESC to close
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(79, 195, 247, 0.2)",
            padding: "0 16px",
          }}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 20px",
                background: activeTab === tab.id ? "rgba(79, 195, 247, 0.15)" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #4fc3f7" : "2px solid transparent",
                color: activeTab === tab.id ? "#4fc3f7" : "rgba(79, 195, 247, 0.6)",
                fontFamily: "monospace",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{ opacity: 0.5, fontSize: 11 }}>({index + 1})</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {activeTab === "overview" && (
            <OverviewTab stats={graphStats} crawlActivity={crawlActivity} />
          )}
          {activeTab === "domains" && (
            <DomainsTab domains={domainStats} onFilterDomain={onFilterDomain} />
          )}
          {activeTab === "timeline" && <TimelineTab timeline={timeline} />}
          {activeTab === "deadlinks" && (
            <DeadLinksTab
              deadLinks={deadLinks}
              selected={selectedDeadLinks}
              onSelect={setSelectedDeadLinks}
              onTeleport={onTeleport}
              onDelete={onDeleteNodes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({
  stats,
  crawlActivity,
}: {
  stats: GraphStats;
  crawlActivity: ReturnType<typeof getCrawlActivity>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Main Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <StatCard icon="🌐" label="Total Nodes" value={stats.totalNodes} />
        <StatCard icon="🔗" label="Connections" value={stats.totalEdges} />
        <StatCard icon="🏠" label="Domains" value={stats.uniqueDomains} />
        <StatCard icon="⭐" label="Favorites" value={stats.favoriteNodes} />
      </div>

      {/* Health Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <StatCard
          icon="✅"
          label="Alive Nodes"
          value={stats.aliveNodes}
          subtext={`${Math.round((stats.aliveNodes / Math.max(stats.totalNodes, 1)) * 100)}%`}
          color="#81c784"
        />
        <StatCard
          icon="💀"
          label="Dead Nodes"
          value={stats.deadNodes}
          subtext={`${Math.round((stats.deadNodes / Math.max(stats.totalNodes, 1)) * 100)}%`}
          color="#e57373"
        />
        <StatCard
          icon="🏝️"
          label="Orphan Nodes"
          value={stats.orphanNodes}
          subtext="No connections"
          color="#ffb74d"
        />
      </div>

      {/* Graph Metrics */}
      <div
        style={{
          background: "rgba(79, 195, 247, 0.05)",
          border: "1px solid rgba(79, 195, 247, 0.2)",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h3
          style={{
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 14,
            margin: "0 0 16px 0",
          }}
        >
          GRAPH METRICS
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <MetricRow label="Avg Connections/Node" value={stats.avgConnectionsPerNode.toFixed(2)} />
          <MetricRow label="Graph Density" value={`${stats.graphDensity.toFixed(2)}%`} />
          <MetricRow label="Max Depth" value={stats.maxDepth} />
          <MetricRow
            label="Crawled Today"
            value={crawlActivity.crawledToday}
          />
        </div>
      </div>

      {/* Hub Nodes */}
      {stats.hubNodes.length > 0 && (
        <div
          style={{
            background: "rgba(79, 195, 247, 0.05)",
            border: "1px solid rgba(79, 195, 247, 0.2)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3
            style={{
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 14,
              margin: "0 0 16px 0",
            }}
          >
            🔥 TOP HUB NODES
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.hubNodes.map((hub, i) => (
              <div
                key={hub.node.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "rgba(79, 195, 247, 0.05)",
                  borderRadius: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "rgba(79, 195, 247, 0.5)", fontSize: 12 }}>#{i + 1}</span>
                  <span
                    style={{
                      color: "#4fc3f7",
                      fontFamily: "monospace",
                      fontSize: 13,
                      maxWidth: 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hub.node.title || hub.node.url}
                  </span>
                </div>
                <span
                  style={{
                    color: "#81c784",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {hub.connections} connections
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Domains Tab
function DomainsTab({
  domains,
  onFilterDomain,
}: {
  domains: DomainStats[];
  onFilterDomain: (domain: string | null) => void;
}) {
  const maxCount = domains.length > 0 ? domains[0].count : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary */}
      <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
        {domains.length} unique domains • Click to filter view
      </div>

      {/* Domain List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {domains.slice(0, 20).map((domain) => (
          <div
            key={domain.domain}
            onClick={() => onFilterDomain(domain.domain)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "rgba(79, 195, 247, 0.05)",
              border: "1px solid rgba(79, 195, 247, 0.1)",
              borderRadius: 6,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(79, 195, 247, 0.1)";
              e.currentTarget.style.borderColor = domain.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(79, 195, 247, 0.05)";
              e.currentTarget.style.borderColor = "rgba(79, 195, 247, 0.1)";
            }}
          >
            {/* Color indicator */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: domain.color,
                boxShadow: `0 0 8px ${domain.color}`,
              }}
            />

            {/* Domain name */}
            <div
              style={{
                flex: 1,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              {domain.domain}
            </div>

            {/* Bar */}
            <div style={{ width: 200, height: 8, background: "rgba(79, 195, 247, 0.1)", borderRadius: 4 }}>
              <div
                style={{
                  width: `${(domain.count / maxCount) * 100}%`,
                  height: "100%",
                  background: domain.color,
                  borderRadius: 4,
                  transition: "width 0.3s",
                }}
              />
            </div>

            {/* Count */}
            <div
              style={{
                color: "rgba(79, 195, 247, 0.8)",
                fontFamily: "monospace",
                fontSize: 12,
                minWidth: 60,
                textAlign: "right",
              }}
            >
              {domain.count} ({domain.percentage.toFixed(1)}%)
            </div>

            {/* Health indicator */}
            <div
              style={{
                color: domain.deadCount > 0 ? "#e57373" : "#81c784",
                fontFamily: "monospace",
                fontSize: 11,
                minWidth: 70,
                textAlign: "right",
              }}
            >
              {domain.deadCount > 0 ? `${domain.deadCount} dead` : "all alive"}
            </div>
          </div>
        ))}
      </div>

      {domains.length > 20 && (
        <div
          style={{
            color: "rgba(79, 195, 247, 0.5)",
            fontFamily: "monospace",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          + {domains.length - 20} more domains
        </div>
      )}

      {/* Clear Filter Button */}
      <button
        onClick={() => onFilterDomain(null)}
        style={{
          padding: "10px 16px",
          background: "rgba(79, 195, 247, 0.1)",
          border: "1px solid rgba(79, 195, 247, 0.3)",
          borderRadius: 6,
          color: "#4fc3f7",
          fontFamily: "monospace",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Clear Domain Filter
      </button>
    </div>
  );
}

// Timeline Tab
function TimelineTab({ timeline }: { timeline: TimelinePoint[] }) {
  if (timeline.length === 0) {
    return (
      <div
        style={{
          color: "rgba(79, 195, 247, 0.5)",
          fontFamily: "monospace",
          fontSize: 14,
          textAlign: "center",
          padding: 40,
        }}
      >
        No timeline data available
      </div>
    );
  }

  const maxCumulative = timeline[timeline.length - 1]?.cumulative || 1;
  const maxDaily = Math.max(...timeline.map((t) => t.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <StatCard icon="📅" label="First Node" value={timeline[0]?.date || "N/A"} small />
        <StatCard
          icon="📅"
          label="Latest Node"
          value={timeline[timeline.length - 1]?.date || "N/A"}
          small
        />
        <StatCard icon="📊" label="Peak Day" value={maxDaily} subtext="nodes added" small />
      </div>

      {/* Chart */}
      <div
        style={{
          background: "rgba(79, 195, 247, 0.05)",
          border: "1px solid rgba(79, 195, 247, 0.2)",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h3
          style={{
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 14,
            margin: "0 0 20px 0",
          }}
        >
          GROWTH OVER TIME
        </h3>

        {/* Simple bar chart */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
            height: 150,
            padding: "0 10px",
          }}
        >
          {timeline.slice(-30).map((point, i) => (
            <div
              key={point.date}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
              title={`${point.date}: ${point.count} nodes (${point.cumulative} total)`}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 20,
                  height: `${(point.count / maxDaily) * 100}%`,
                  minHeight: point.count > 0 ? 4 : 0,
                  background: "#4fc3f7",
                  borderRadius: "2px 2px 0 0",
                  transition: "height 0.3s",
                }}
              />
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            padding: "0 10px",
          }}
        >
          <span style={{ color: "rgba(79, 195, 247, 0.5)", fontSize: 10, fontFamily: "monospace" }}>
            {timeline.slice(-30)[0]?.date || ""}
          </span>
          <span style={{ color: "rgba(79, 195, 247, 0.5)", fontSize: 10, fontFamily: "monospace" }}>
            {timeline[timeline.length - 1]?.date || ""}
          </span>
        </div>
      </div>

      {/* Recent Activity */}
      <div
        style={{
          background: "rgba(79, 195, 247, 0.05)",
          border: "1px solid rgba(79, 195, 247, 0.2)",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h3
          style={{
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 14,
            margin: "0 0 16px 0",
          }}
        >
          RECENT ACTIVITY
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {timeline.slice(-7).reverse().map((point) => (
            <div
              key={point.date}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "rgba(79, 195, 247, 0.03)",
                borderRadius: 4,
              }}
            >
              <span style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 12 }}>
                {point.date}
              </span>
              <span style={{ color: "#81c784", fontFamily: "monospace", fontSize: 12 }}>
                +{point.count} nodes
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Dead Links Tab
function DeadLinksTab({
  deadLinks,
  selected,
  onSelect,
  onTeleport,
  onDelete,
}: {
  deadLinks: DeadLink[];
  selected: Set<number>;
  onSelect: (selected: Set<number>) => void;
  onTeleport: (node: VoidNode) => void;
  onDelete: (nodes: VoidNode[]) => void;
}) {
  const toggleSelect = (id: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelect(newSelected);
  };

  const selectAll = () => {
    onSelect(new Set(deadLinks.map((d) => d.node.id)));
  };

  const selectNone = () => {
    onSelect(new Set());
  };

  const deleteSelected = () => {
    const nodesToDelete = deadLinks.filter((d) => selected.has(d.node.id)).map((d) => d.node);
    if (nodesToDelete.length > 0) {
      onDelete(nodesToDelete);
      onSelect(new Set());
    }
  };

  if (deadLinks.length === 0) {
    return (
      <div
        style={{
          color: "#81c784",
          fontFamily: "monospace",
          fontSize: 14,
          textAlign: "center",
          padding: 40,
        }}
      >
        ✅ No dead links found! All nodes are alive.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          background: "rgba(229, 115, 115, 0.1)",
          border: "1px solid rgba(229, 115, 115, 0.3)",
          borderRadius: 8,
        }}
      >
        <div style={{ color: "#e57373", fontFamily: "monospace", fontSize: 13 }}>
          💀 {deadLinks.length} dead links found
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={selectAll}
            style={{
              padding: "6px 12px",
              background: "transparent",
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
          <button
            onClick={selectNone}
            style={{
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 4,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Select None
          </button>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            style={{
              padding: "6px 12px",
              background: selected.size > 0 ? "rgba(229, 115, 115, 0.2)" : "transparent",
              border: "1px solid rgba(229, 115, 115, 0.5)",
              borderRadius: 4,
              color: selected.size > 0 ? "#e57373" : "rgba(229, 115, 115, 0.5)",
              fontFamily: "monospace",
              fontSize: 11,
              cursor: selected.size > 0 ? "pointer" : "not-allowed",
            }}
          >
            Delete Selected ({selected.size})
          </button>
        </div>
      </div>

      {/* Dead Links List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {deadLinks.map((link) => (
          <div
            key={link.node.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: selected.has(link.node.id)
                ? "rgba(229, 115, 115, 0.15)"
                : "rgba(79, 195, 247, 0.03)",
              border: `1px solid ${
                selected.has(link.node.id) ? "rgba(229, 115, 115, 0.5)" : "rgba(79, 195, 247, 0.1)"
              }`,
              borderRadius: 6,
              transition: "all 0.2s",
            }}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={selected.has(link.node.id)}
              onChange={() => toggleSelect(link.node.id)}
              style={{ cursor: "pointer" }}
            />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: "#e57373",
                  fontFamily: "monospace",
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {link.node.title || link.node.url}
              </div>
              <div
                style={{
                  color: "rgba(79, 195, 247, 0.5)",
                  fontFamily: "monospace",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {link.domain} • Last checked:{" "}
                {link.lastCrawled ? new Date(link.lastCrawled).toLocaleDateString() : "Never"}
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={() => onTeleport(link.node)}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid rgba(79, 195, 247, 0.3)",
                borderRadius: 4,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Teleport
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper Components
function StatCard({
  icon,
  label,
  value,
  subtext,
  color = "#4fc3f7",
  small = false,
}: {
  icon: string;
  label: string;
  value: number | string;
  subtext?: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(79, 195, 247, 0.05)",
        border: "1px solid rgba(79, 195, 247, 0.2)",
        borderRadius: 8,
        padding: small ? "12px 16px" : "16px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: small ? 18 : 24, marginBottom: small ? 4 : 8 }}>{icon}</div>
      <div
        style={{
          color,
          fontFamily: "monospace",
          fontSize: small ? 18 : 28,
          fontWeight: "bold",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "rgba(79, 195, 247, 0.6)",
          fontFamily: "monospace",
          fontSize: small ? 10 : 11,
          marginTop: 4,
        }}
      >
        {label}
      </div>
      {subtext && (
        <div
          style={{
            color: "rgba(79, 195, 247, 0.4)",
            fontFamily: "monospace",
            fontSize: small ? 9 : 10,
            marginTop: 2,
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 12 }}>
        {label}
      </span>
      <span style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 13, fontWeight: "bold" }}>
        {value}
      </span>
    </div>
  );
}

export default StatsPanel;
