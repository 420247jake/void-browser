import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CrawlerSettings {
  maxNodes: number;
  maxDepth: number;
  takeScreenshots: boolean;
  screenshotDelay: number;
}

interface CrawlModalProps {
  isOpen: boolean;
  onClose: () => void;
  crawlerSettings: CrawlerSettings;
  onCrawlComplete?: () => void;
}

type CrawlStatus = "idle" | "crawling" | "complete" | "error";

export function CrawlModal({ 
  isOpen, 
  onClose, 
  crawlerSettings,
  onCrawlComplete 
}: CrawlModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<CrawlStatus>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => urlInputRef.current?.focus(), 100);
      // Reset state
      setStatus("idle");
      setProgress("");
      setError(null);
    }
  }, [isOpen]);

  // Auto-generate name from URL
  const handleUrlChange = useCallback((newUrl: string) => {
    setUrl(newUrl);
    if (!name || name === extractDomain(url)) {
      setName(extractDomain(newUrl));
    }
  }, [name, url]);

  const extractDomain = (urlStr: string): string => {
    try {
      let cleanUrl = urlStr.trim();
      if (!cleanUrl.startsWith("http")) {
        cleanUrl = "https://" + cleanUrl;
      }
      const hostname = new URL(cleanUrl).hostname;
      return hostname.replace("www.", "").split(".")[0];
    } catch {
      return "";
    }
  };

  const handleCrawl = useCallback(async () => {
    if (!url.trim()) return;

    let crawlUrl = url.trim();
    if (!crawlUrl.startsWith("http://") && !crawlUrl.startsWith("https://")) {
      crawlUrl = "https://" + crawlUrl;
    }

    const crawlName = name.trim() || extractDomain(crawlUrl);

    setStatus("crawling");
    setProgress("Starting crawler...");
    setError(null);

    try {
      // Call Tauri command to run crawler
      const result = await invoke<string>("run_crawler", {
        url: crawlUrl,
        name: crawlName,
        maxPages: crawlerSettings.maxNodes,
        maxDepth: crawlerSettings.maxDepth,
        screenshots: crawlerSettings.takeScreenshots,
        screenshotDelay: crawlerSettings.screenshotDelay,
      });

      setStatus("complete");
      setProgress(result);
      
      // Auto-close after success and trigger reload
      setTimeout(() => {
        onCrawlComplete?.();
        onClose();
      }, 2000);
    } catch (err) {
      setStatus("error");
      setError(String(err));
    }
  }, [url, name, crawlerSettings, onCrawlComplete, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(10, 10, 30, 0.98)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          width: 480,
          maxWidth: "90vw",
          overflow: "hidden",
          boxShadow: "0 0 50px rgba(79, 195, 247, 0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
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
              color: "#4fc3f7",
              fontFamily: "monospace",
              margin: 0,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            🕷️ Crawl Website
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(79, 195, 247, 0.6)",
              fontSize: 20,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {status === "idle" && (
            <>
              {/* URL Input */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  Website URL
                </label>
                <input
                  ref={urlInputRef}
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && url.trim()) handleCrawl();
                  }}
                  placeholder="example.com or https://example.com"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(79, 195, 247, 0.1)",
                    border: "1px solid rgba(79, 195, 247, 0.3)",
                    borderRadius: 6,
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Name Input */}
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: "block",
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  Void Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-generated from URL"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(79, 195, 247, 0.1)",
                    border: "1px solid rgba(79, 195, 247, 0.3)",
                    borderRadius: 6,
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Settings Preview */}
              <div
                style={{
                  background: "rgba(79, 195, 247, 0.05)",
                  border: "1px solid rgba(79, 195, 247, 0.15)",
                  borderRadius: 6,
                  padding: "12px 16px",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    color: "rgba(79, 195, 247, 0.6)",
                    fontFamily: "monospace",
                    fontSize: 11,
                    marginBottom: 8,
                  }}
                >
                  CRAWLER SETTINGS (change in Settings → Crawler)
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px 20px",
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  <span style={{ opacity: 0.5 }}>Max Pages:</span>
                  <span>{crawlerSettings.maxNodes}</span>
                  <span style={{ opacity: 0.5 }}>Depth:</span>
                  <span>{crawlerSettings.maxDepth} levels</span>
                  <span style={{ opacity: 0.5 }}>Screenshots:</span>
                  <span>{crawlerSettings.takeScreenshots ? "Yes" : "No"}</span>
                </div>
              </div>

              {/* Crawl Button */}
              <button
                onClick={handleCrawl}
                disabled={!url.trim()}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: url.trim() 
                    ? "linear-gradient(135deg, rgba(79, 195, 247, 0.3), rgba(79, 195, 247, 0.15))"
                    : "rgba(79, 195, 247, 0.1)",
                  border: url.trim() 
                    ? "2px solid #4fc3f7" 
                    : "1px solid rgba(79, 195, 247, 0.2)",
                  borderRadius: 8,
                  color: url.trim() ? "#4fc3f7" : "rgba(79, 195, 247, 0.4)",
                  fontFamily: "monospace",
                  fontSize: 15,
                  fontWeight: "bold",
                  cursor: url.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
              >
                🚀 Start Crawling
              </button>
            </>
          )}

          {status === "crawling" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  border: "3px solid rgba(79, 195, 247, 0.2)",
                  borderTop: "3px solid #4fc3f7",
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                  animation: "spin 1s linear infinite",
                }}
              />
              <div
                style={{
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 16,
                  marginBottom: 10,
                }}
              >
                Crawling {extractDomain(url)}...
              </div>
              <div
                style={{
                  color: "rgba(79, 195, 247, 0.6)",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              >
                {progress}
              </div>
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {status === "complete" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div
                style={{
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 16,
                  marginBottom: 10,
                }}
              >
                Crawl Complete!
              </div>
              <div
                style={{
                  color: "rgba(79, 195, 247, 0.6)",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              >
                {progress}
              </div>
            </div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <div
                style={{
                  color: "#f55",
                  fontFamily: "monospace",
                  fontSize: 14,
                  marginBottom: 16,
                }}
              >
                Crawl Failed
              </div>
              <div
                style={{
                  color: "rgba(255, 100, 100, 0.7)",
                  fontFamily: "monospace",
                  fontSize: 11,
                  background: "rgba(255, 50, 50, 0.1)",
                  padding: "10px 14px",
                  borderRadius: 6,
                  marginBottom: 20,
                  textAlign: "left",
                  maxHeight: 100,
                  overflow: "auto",
                }}
              >
                {error}
              </div>
              <button
                onClick={() => setStatus("idle")}
                style={{
                  padding: "10px 24px",
                  background: "rgba(79, 195, 247, 0.15)",
                  border: "1px solid #4fc3f7",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
