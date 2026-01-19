/**
 * Sitemap Import Modal
 * Import URLs from XML sitemaps or robots.txt
 */

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseSitemap, parseSitemapFromRobots, SitemapEntry } from "../lib/crawlAnalytics";

interface SitemapImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export function SitemapImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: SitemapImportModalProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [entries, setEntries] = useState<SitemapEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [step, setStep] = useState<"input" | "preview" | "done">("input");

  const handleFetchSitemap = useCallback(async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setEntries([]);

    try {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith("http")) {
        targetUrl = "https://" + targetUrl;
      }

      // Check if it's a robots.txt
      const isRobots = targetUrl.includes("robots.txt");
      
      // Fetch the content
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      
      let parsedEntries: SitemapEntry[] = [];
      
      if (isRobots) {
        // Parse robots.txt for sitemap URLs
        const sitemapUrls = parseSitemapFromRobots(content);
        if (sitemapUrls.length === 0) {
          throw new Error("No sitemap URLs found in robots.txt");
        }
        
        // Fetch each sitemap
        for (const sitemapUrl of sitemapUrls) {
          try {
            const sitemapResponse = await fetch(sitemapUrl);
            const sitemapContent = await sitemapResponse.text();
            const sitemapEntries = parseSitemap(sitemapContent);
            parsedEntries.push(...sitemapEntries);
          } catch (err) {
            console.warn(`Failed to fetch sitemap ${sitemapUrl}:`, err);
          }
        }
      } else {
        // Parse as sitemap XML directly
        parsedEntries = parseSitemap(content);
      }
      
      if (parsedEntries.length === 0) {
        throw new Error("No URLs found in sitemap");
      }
      
      // Filter out sitemap index entries (they point to other sitemaps)
      const urlEntries = parsedEntries.filter(e => e.changefreq !== "sitemap-index");
      
      setEntries(urlEntries);
      setSelectedEntries(new Set(urlEntries.slice(0, 100).map(e => e.url))); // Select first 100 by default
      setStep("preview");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  const handleImport = useCallback(async () => {
    if (selectedEntries.size === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      let added = 0;
      let skipped = 0;

      for (const entryUrl of selectedEntries) {
        try {
          const entry = entries.find(e => e.url === entryUrl);
          const title = entry?.url ? new URL(entry.url).pathname : entry?.url;
          
          await invoke("add_node_url", {
            url: entryUrl,
            title: title || entryUrl,
          });
          added++;
        } catch {
          skipped++;
        }
      }

      setImportResult({ added, skipped });
      setStep("done");
      onImportComplete();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedEntries, entries, onImportComplete]);

  const toggleEntry = (url: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedEntries(new Set(entries.map(e => e.url)));
  };

  const selectNone = () => {
    setSelectedEntries(new Set());
  };

  const handleReset = () => {
    setStep("input");
    setEntries([]);
    setSelectedEntries(new Set());
    setError(null);
    setImportResult(null);
  };

  if (!isOpen) return null;

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
          padding: 24,
          width: 550,
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
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
            🗺️ Import Sitemap
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

        {/* Step: Input URL */}
        {step === "input" && (
          <>
            <p
              style={{
                color: "rgba(79, 195, 247, 0.7)",
                fontFamily: "monospace",
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              Enter a sitemap URL (sitemap.xml) or robots.txt URL to discover pages.
            </p>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetchSitemap()}
                placeholder="https://example.com/sitemap.xml"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "rgba(79, 195, 247, 0.1)",
                  border: "1px solid rgba(79, 195, 247, 0.3)",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                onClick={handleFetchSitemap}
                disabled={isLoading || !url.trim()}
                style={{
                  padding: "10px 20px",
                  background: "rgba(79, 195, 247, 0.2)",
                  border: "1px solid #4fc3f7",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: isLoading ? "wait" : "pointer",
                  opacity: isLoading || !url.trim() ? 0.5 : 1,
                }}
              >
                {isLoading ? "Loading..." : "Fetch"}
              </button>
            </div>

            <div
              style={{
                color: "rgba(79, 195, 247, 0.5)",
                fontFamily: "monospace",
                fontSize: 11,
                marginBottom: 12,
              }}
            >
              Examples:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "https://example.com/sitemap.xml",
                "https://example.com/robots.txt",
                "https://example.com/sitemap_index.xml",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setUrl(example)}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(79, 195, 247, 0.05)",
                    border: "1px solid rgba(79, 195, 247, 0.2)",
                    borderRadius: 4,
                    color: "rgba(79, 195, 247, 0.7)",
                    fontFamily: "monospace",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step: Preview & Select */}
        {step === "preview" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                }}
              >
                Found {entries.length} URLs • {selectedEntries.size} selected
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={selectAll}
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
                  All
                </button>
                <button
                  onClick={selectNone}
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
                  None
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflow: "auto",
                background: "rgba(79, 195, 247, 0.05)",
                border: "1px solid rgba(79, 195, 247, 0.2)",
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              {entries.slice(0, 200).map((entry) => (
                <label
                  key={entry.url}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(79, 195, 247, 0.1)",
                    cursor: "pointer",
                    background: selectedEntries.has(entry.url)
                      ? "rgba(79, 195, 247, 0.1)"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedEntries.has(entry.url)}
                    onChange={() => toggleEntry(entry.url)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#4fc3f7",
                        fontFamily: "monospace",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.url}
                    </div>
                    {entry.lastmod && (
                      <div
                        style={{
                          color: "rgba(79, 195, 247, 0.5)",
                          fontFamily: "monospace",
                          fontSize: 10,
                        }}
                      >
                        Modified: {entry.lastmod}
                      </div>
                    )}
                  </div>
                  {entry.priority !== undefined && (
                    <span
                      style={{
                        color: "rgba(79, 195, 247, 0.5)",
                        fontFamily: "monospace",
                        fontSize: 10,
                      }}
                    >
                      {entry.priority}
                    </span>
                  )}
                </label>
              ))}
              {entries.length > 200 && (
                <div
                  style={{
                    padding: 12,
                    textAlign: "center",
                    color: "rgba(79, 195, 247, 0.5)",
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                >
                  Showing first 200 of {entries.length} URLs
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={handleReset}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "1px solid rgba(79, 195, 247, 0.3)",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={isLoading || selectedEntries.size === 0}
                style={{
                  padding: "10px 24px",
                  background: "rgba(79, 195, 247, 0.2)",
                  border: "1px solid #4fc3f7",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: isLoading ? "wait" : "pointer",
                  opacity: isLoading || selectedEntries.size === 0 ? 0.5 : 1,
                }}
              >
                {isLoading ? "Importing..." : `Import ${selectedEntries.size} URLs`}
              </button>
            </div>
          </>
        )}

        {/* Step: Done */}
        {step === "done" && importResult && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div
              style={{
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 18,
                marginBottom: 20,
              }}
            >
              Import Complete!
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  background: "rgba(76, 175, 80, 0.1)",
                  border: "1px solid rgba(76, 175, 80, 0.3)",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ color: "#4caf50", fontSize: 24, fontWeight: "bold" }}>
                  {importResult.added}
                </div>
                <div style={{ color: "rgba(76, 175, 80, 0.7)", fontSize: 12, fontFamily: "monospace" }}>
                  URLs Added
                </div>
              </div>
              <div
                style={{
                  background: "rgba(255, 152, 0, 0.1)",
                  border: "1px solid rgba(255, 152, 0, 0.3)",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ color: "#ff9800", fontSize: 24, fontWeight: "bold" }}>
                  {importResult.skipped}
                </div>
                <div style={{ color: "rgba(255, 152, 0, 0.7)", fontSize: 12, fontFamily: "monospace" }}>
                  Duplicates Skipped
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={handleReset}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "1px solid rgba(79, 195, 247, 0.3)",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Import More
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 24px",
                  background: "rgba(79, 195, 247, 0.2)",
                  border: "1px solid #4fc3f7",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div
            style={{
              background: "rgba(244, 67, 54, 0.1)",
              border: "1px solid rgba(244, 67, 54, 0.3)",
              borderRadius: 6,
              padding: 12,
              marginTop: 16,
              color: "#f44336",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
