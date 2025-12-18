import React from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { RefreshCcw, Trash2, Play, Square, Filter, Search, ChevronDown, BarChart3, Terminal } from "lucide-react";

interface LogcatProps {
  currentSerial: () => string | null;
  status: string;
}

const ACCENT = "#FFD86A";
const TARGET_PACKAGE = "com.cccintegra.pax";

interface LogEntry {
  timestamp: string;
  level: string;
  tag: string;
  pid: string;
  tid: string;
  message: string;
  fullLine: string;
}

export default function Logcat({ currentSerial, status }: LogcatProps) {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [levelFilter, setLevelFilter] = React.useState<string>("all");
  const [showAppOnly, setShowAppOnly] = React.useState(true);
  const [additionalFilter, setAdditionalFilter] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showFiltersDropdown, setShowFiltersDropdown] = React.useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [maxLines] = React.useState(500);
  
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const logsContainerRef = React.useRef<HTMLDivElement>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = React.useRef<string>('');

  const serial = currentSerial();

  // Parse logcat line into structured data
  const parseLogLine = (line: string): LogEntry | null => {
    if (!line.trim()) return null;
    
    // Handle multi-line log entries (long format can span multiple lines)
    if (line.startsWith('[ ') || line.startsWith('-----')) {
      return null; // Skip separator lines
    }
    
    // Try threadtime format: MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG : MESSAGE
    const threadtimeRegex = /^(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+)\s*:\s*(.*)$/;
    const threadtimeMatch = line.match(threadtimeRegex);
    
    if (threadtimeMatch) {
      return {
        timestamp: threadtimeMatch[1],
        pid: threadtimeMatch[2],
        tid: threadtimeMatch[3],
        tag: threadtimeMatch[5].trim(),
        level: threadtimeMatch[4],
        message: threadtimeMatch[6],
        fullLine: line
      };
    }
    
    // Try Android Studio format: YYYY-MM-DD HH:MM:SS.mmm  PID-TID  TAG  PACKAGE  LEVEL  MESSAGE
    const studioRegex = /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)-(\d+)\s+([^\s]+)\s+([^\s]+)\s+([VDIWEF])\s+(.*)$/;
    const studioMatch = line.match(studioRegex);
    
    if (studioMatch) {
      return {
        timestamp: studioMatch[1],
        pid: studioMatch[2],
        tid: studioMatch[3],
        tag: studioMatch[4],
        level: studioMatch[6],
        message: studioMatch[7],
        fullLine: line
      };
    }
    
    // Try standard logcat format: MM-DD HH:MM:SS.mmm PID-TID/TAG LEVEL/MESSAGE
    const standardRegex = /^(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)-(\d+)\/([^\s]+)\s+([VDIWEF])\/(.*)$/;
    const standardMatch = line.match(standardRegex);
    
    if (standardMatch) {
      return {
        timestamp: standardMatch[1],
        pid: standardMatch[2],
        tid: standardMatch[3],
        tag: standardMatch[4],
        level: standardMatch[5],
        message: standardMatch[6],
        fullLine: line
      };
    }
    
    // Try time format: MM-DD HH:MM:SS.mmm LEVEL/TAG(PID): MESSAGE
    const timeRegex = /^(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+([VDIWEF])\/([^(]+)\(\s*(\d+)\):\s*(.*)$/;
    const timeMatch = line.match(timeRegex);
    
    if (timeMatch) {
      return {
        timestamp: timeMatch[1],
        pid: timeMatch[4],
        tid: "",
        tag: timeMatch[3].trim(),
        level: timeMatch[2],
        message: timeMatch[5],
        fullLine: line
      };
    }
    
    // If it looks like a continuation line (starts with whitespace), treat as message
    if (line.match(/^\s+/)) {
      return {
        timestamp: "",
        level: "",
        tag: "",
        pid: "",
        tid: "",
        message: line.trim(),
        fullLine: line
      };
    }
    
    // Fallback for lines that don't match any standard format
    return {
      timestamp: "",
      level: "I",
      tag: "",
      pid: "",
      tid: "",
      message: line,
      fullLine: line
    };
  };

  // Get log level color
  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'V': return '#888888'; // Verbose - Gray
      case 'D': return '#0070f3'; // Debug - Blue
      case 'I': return '#00d084'; // Info - Green
      case 'W': return '#f5a623'; // Warning - Orange
      case 'E': return '#ff0040'; // Error - Red
      case 'F': return '#9013fe'; // Fatal - Purple
      default: return '#ffffff';
    }
  };

  // Get level display info
  const getLevelInfo = (level: string) => {
    switch (level) {
      case 'V': return { letter: 'V', name: 'Verbose', color: '#888888' };
      case 'D': return { letter: 'D', name: 'Debug', color: '#0070f3' };
      case 'I': return { letter: 'I', name: 'Info', color: '#00d084' };
      case 'W': return { letter: 'W', name: 'Warning', color: '#f5a623' };
      case 'E': return { letter: 'E', name: 'Error', color: '#ff0040' };
      case 'F': return { letter: 'F', name: 'Fatal', color: '#9013fe' };
      default: return { letter: '', name: 'All Levels', color: '#ffffff' };
    }
  };

  const levelOptions = [
    { value: 'all', ...getLevelInfo('all') },
    { value: 'V', ...getLevelInfo('V') },
    { value: 'D', ...getLevelInfo('D') },
    { value: 'I', ...getLevelInfo('I') },
    { value: 'W', ...getLevelInfo('W') },
    { value: 'E', ...getLevelInfo('E') },
    { value: 'F', ...getLevelInfo('F') }
  ];

  // Track PIDs associated with our package
  const [packagePids, setPackagePids] = React.useState<Set<string>>(new Set());

  // Extract PIDs associated with the package filter from the logs
  React.useEffect(() => {
    if (!showAppOnly) {
      setPackagePids(new Set());
      return;
    }

    const pids = new Set<string>();
    const filter = TARGET_PACKAGE.toLowerCase();
    
    logs.forEach(log => {
      const fullLine = log.fullLine.toLowerCase();
      
      // Look for ANY log that mentions our package and has a PID
      if (fullLine.includes(filter) && log.pid && log.pid.trim()) {
        // Add this PID as potentially belonging to our package
        pids.add(log.pid);
      }
    });
    setPackagePids(pids);
  }, [logs, showAppOnly]);

  // Filter logs based on current filters
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // Level filter
      if (levelFilter !== "all" && log.level && log.level !== levelFilter.toUpperCase()) {
        return false;
      }
      
      // App filter (checkbox) - Use PID-based filtering with fallback
      if (showAppOnly) {
        const filter = TARGET_PACKAGE.toLowerCase();
        const fullLine = log.fullLine.toLowerCase();
        
        // If we have PIDs detected, use them
        if (packagePids.size > 0) {
          if (log.pid && packagePids.has(log.pid)) {
            return true;
          }
          // If we have PIDs but this log doesn't match, reject it
          return false;
        }
        
        // Fallback: If no PIDs detected yet, use basic package name matching
        // This ensures we show something while PID detection is working
        if (fullLine.includes(filter)) {
          return true;
        }
        
        return false;
      }
      
      // Additional filter from dropdown
      if (additionalFilter && additionalFilter.trim()) {
        const filterText = additionalFilter.toLowerCase().trim();
        const message = log.message.toLowerCase();
        const tag = log.tag.toLowerCase();
        const fullLine = log.fullLine.toLowerCase();
        
        const matchesText = fullLine.includes(filterText) || 
                           message.includes(filterText) || 
                           tag.includes(filterText);
        
        if (!matchesText) {
          return false;
        }
      }

      // Search query - main search functionality
      if (searchQuery && searchQuery.trim()) {
        const search = searchQuery.toLowerCase().trim();
        const message = log.message ? log.message.toLowerCase() : '';
        const tag = log.tag ? log.tag.toLowerCase() : '';
        const fullLine = log.fullLine ? log.fullLine.toLowerCase() : '';
        
        const matchesSearch = fullLine.includes(search) || 
                             message.includes(search) || 
                             tag.includes(search);
        
        if (!matchesSearch) {
          return false;
        }
      }
      
      return true;
    });
  }, [logs, levelFilter, showAppOnly, additionalFilter, searchQuery, packagePids]);

  // Auto scroll to bottom
  React.useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredLogs, autoScroll]);

  // Disable auto-scroll when user manually scrolls
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10; // 10px threshold
    
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  }, [autoScroll]);

  // Re-enable auto-scroll when user scrolls back to bottom
  const enableAutoScroll = () => {
    setAutoScroll(true);
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Highlight search text in log content
  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === search.toLowerCase()) {
        return (
          <mark 
            key={index}
            style={{ 
              background: ACCENT,
              color: "#000",
              padding: "1px 2px",
              borderRadius: "2px"
            }}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Copy filtered logs to clipboard
  const copyLogs = async () => {
    const logText = filteredLogs.map(log => {
      const timestamp = log.timestamp || '';
      const pid = log.pid || '';
      const tid = log.tid || '';
      const level = log.level || '';
      const tag = log.tag || '';
      const message = log.message || '';
      
      if (timestamp && pid && tid) {
        return `${timestamp}  ${pid}-${tid}  ${level}  ${tag}: ${message}`;
      } else {
        return log.fullLine || `${level}  ${tag}: ${message}`;
      }
    }).join('\n');
    
    try {
      await navigator.clipboard.writeText(logText);
      console.log('Logs copied to clipboard');
    } catch (error) {
      console.error('Failed to copy logs:', error);
    }
  };

  // Fetch logs periodically when running
  const fetchLogs = async () => {
    if (!serial) return;
    
    try {
      const result = await window.firefly.getLogcatSnapshot({
        serial,
        packageName: undefined, // Don't pass package filter - we'll filter on frontend
        maxLines: 2000 // Increase to get more logs like Android Studio
      });
      
      if (result.success && result.logs) {
        const allNewLogs = result.logs
          .split('\n')
          .map(parseLogLine)
          .filter((entry: LogEntry | null): entry is LogEntry => entry !== null);
        
        // On first run, set all logs
        if (lastTimestampRef.current === '') {
          flushSync(() => {
            setLogs(allNewLogs);
          });
          // Update last timestamp to the most recent log
          if (allNewLogs.length > 0) {
            const lastLog = allNewLogs[allNewLogs.length - 1];
            lastTimestampRef.current = lastLog.timestamp;
          }
        } else {
          // Find new logs since last timestamp
          const lastTimestamp = lastTimestampRef.current;
          const genuinelyNewLogs = allNewLogs.filter(log => {
            return log.timestamp > lastTimestamp;
          });
          
          if (genuinelyNewLogs.length > 0) {
            // Append only the new logs
            flushSync(() => {
              setLogs(prevLogs => {
                const combined = [...prevLogs, ...genuinelyNewLogs];
                // Keep only the last maxLines entries to prevent memory issues
                return combined.slice(-maxLines);
              });
            });
            
            // Update last timestamp
            const lastLog = genuinelyNewLogs[genuinelyNewLogs.length - 1];
            lastTimestampRef.current = lastLog.timestamp;
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  // Start/stop logcat polling
  const toggleLogcat = async () => {
    if (!serial) {
      alert("No device selected");
      return;
    }

    if (isRunning) {
      // Stop
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
    } else {
      // Start
      setIsRunning(true);
      
      // Clear existing logs first
      await window.firefly.clearLogcat({ serial });
      setLogs([]);
      
      // Start polling for logs - very frequent polling for smooth updates
      intervalRef.current = setInterval(fetchLogs, 250); // Update every 250ms
      
      // Fetch initial logs
      fetchLogs();
    }
  };

  // Clear logs
  const clearLogs = async () => {
    if (!serial) return;
    
    try {
      await window.firefly.clearLogcat({ serial });
      setLogs([]);
      lastTimestampRef.current = ''; // Reset timestamp tracking
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  };

  // Cleanup interval on unmount
  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (showFiltersDropdown) {
        setShowFiltersDropdown(false);
      }
      if (showLevelDropdown) {
        setShowLevelDropdown(false);
      }
    };

    if (showFiltersDropdown || showLevelDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showFiltersDropdown, showLevelDropdown]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b"
           style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" color="#fff" />
          <h2 className="text-lg font-semibold text-white">Logcat</h2>
        </div>
        <div className="text-xs text-white/60">{status}</div>
      </div>

      {/* Controls */}
      <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {/* Top row - Start/Stop and Clear */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLogcat}
            disabled={!serial}
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{
              background: isRunning ? "#dc3545" : ACCENT,
              color: "#1a1a1a",
              opacity: !serial ? 0.5 : 1
            }}
          >
            {isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Stop" : "Start"}
          </button>

          <button
            onClick={clearLogs}
            disabled={!serial}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-white/5"
            style={{ 
              borderColor: "rgba(255,255,255,0.12)", 
              color: "#fff",
              opacity: !serial ? 0.5 : 1
            }}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>

          <button
            onClick={fetchLogs}
            disabled={!serial || isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-white/5"
            style={{ 
              borderColor: "rgba(255,255,255,0.12)", 
              color: "#fff",
              opacity: (!serial || isRunning) ? 0.5 : 1
            }}
          >
            <motion.div
              whileHover={(!serial || isRunning) ? {} : { rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <RefreshCcw className="h-4 w-4" />
            </motion.div>
            Refresh
          </button>

          <div className="flex-1" />

          <div className="text-sm text-white/60">
            {filteredLogs.length} / {logs.length} lines
            {packagePids.size > 0 && (
              <span className="ml-2">
                (PIDs: {Array.from(packagePids).join(', ')})
              </span>
            )}
          </div>
        </div>

        {/* Second row - Search and Filters */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex items-center gap-2 flex-1 relative">
            <Search className="h-4 w-4 text-white/60 absolute left-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="flex-1 pl-10 pr-3 py-2 rounded text-sm"
              style={{ 
                background: "rgba(255,255,255,0.06)", 
                color: "#fff", 
                border: "1px solid rgba(255,255,255,0.1)",
                maxWidth: "400px"
              }}
            />
          </div>

          {/* Filters Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFiltersDropdown(!showFiltersDropdown);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm border hover:bg-white/5"
              style={{ 
                borderColor: "rgba(255,255,255,0.12)", 
                color: "#fff"
              }}
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${showFiltersDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Content */}
            {showFiltersDropdown && (
              <div 
                className="absolute right-0 top-full mt-1 bg-gray-800 border rounded-lg shadow-lg z-10 p-3 space-y-3"
                style={{ 
                  borderColor: "rgba(255,255,255,0.12)",
                  minWidth: "250px"
                }}
              >
                <div className="flex items-center gap-2">
                  <label className="text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={showAppOnly}
                      onChange={(e) => setShowAppOnly(e.target.checked)}
                      className="mr-2"
                    />
                    Show {TARGET_PACKAGE} only
                  </label>
                </div>

                <div>
                  <label className="text-sm text-white/80 block mb-1">Additional Filter:</label>
                  <input
                    type="text"
                    value={additionalFilter}
                    onChange={(e) => setAdditionalFilter(e.target.value)}
                    placeholder="welcome, error, etc..."
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ 
                      background: "rgba(255,255,255,0.06)", 
                      color: "#fff", 
                      border: "1px solid rgba(255,255,255,0.1)"
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLevelDropdown(!showLevelDropdown);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs border hover:bg-white/5"
              style={{ 
                borderColor: "rgba(255,255,255,0.12)", 
                color: "#fff",
                minWidth: "100px",
                justifyContent: "space-between"
              }}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {levelFilter !== 'all' && (
                  <span 
                    className="font-bold text-center"
                    style={{ 
                      color: getLevelColor(levelFilter),
                      width: "10px"
                    }}
                  >
                    {levelFilter}
                  </span>
                )}
                <span>{getLevelInfo(levelFilter).name}</span>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform ${showLevelDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Level Dropdown */}
            {showLevelDropdown && (
              <div 
                className="absolute right-0 top-full mt-1 bg-gray-800 border rounded-lg shadow-lg z-10 py-1"
                style={{ 
                  borderColor: "rgba(255,255,255,0.12)",
                  minWidth: "130px"
                }}
              >
                {levelOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setLevelFilter(option.value);
                      setShowLevelDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2 text-xs"
                    style={{ color: "#fff" }}
                  >
                    {option.letter && (
                      <span 
                        className="font-bold text-center"
                        style={{ 
                          color: option.color,
                          width: "10px"
                        }}
                      >
                        {option.letter}
                      </span>
                    )}
                    <span>{option.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-white/80">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="mr-1"
              />
              Auto-scroll
            </label>
            {!autoScroll && (
              <button
                onClick={enableAutoScroll}
                className="text-xs px-2 py-1 rounded border hover:bg-white/5"
                style={{ 
                  borderColor: "rgba(255,255,255,0.12)", 
                  color: ACCENT
                }}
              >
                ↓ Bottom
              </button>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={copyLogs}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm border hover:bg-white/5"
            style={{ 
              borderColor: "rgba(255,255,255,0.12)", 
              color: "#fff"
            }}
          >
            Copy Logs
          </button>
        </div>
      </div>

      {/* Logs area */}
      <div className="flex-1 flex flex-col min-h-0 p-6">
        <div
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto rounded-lg p-4 font-mono text-sm"
          style={{ 
            background: "rgba(0,0,0,0.3)", 
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          {!serial ? (
            <div className="text-center text-white/60 py-8">
              Select a device to view logs
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              {isRunning ? "Waiting for logs..." : "No logs available. Click 'Start' to begin capturing."}
            </div>
          ) : (
            <>
              {filteredLogs.map((log, index) => (
                <div key={index} className="flex gap-2 py-1 hover:bg-white/5" style={{ fontSize: "11px", fontFamily: "Consolas, 'Courier New', monospace" }}>
                  {log.timestamp && (
                    <span className="text-white/60 shrink-0" style={{ width: "120px" }}>
                      {log.timestamp}
                    </span>
                  )}
                  {!log.timestamp && <span style={{ width: "120px" }}></span>}
                  
                  {log.level && (
                    <span 
                      className="shrink-0 font-bold text-center"
                      style={{ 
                        color: getLevelColor(log.level),
                        width: "20px"
                      }}
                    >
                      {log.level}
                    </span>
                  )}
                  {!log.level && <span style={{ width: "20px" }}></span>}
                  
                  {log.tag && (
                    <span className="text-cyan-400 shrink-0 truncate" style={{ width: "150px" }} title={log.tag}>
                      {searchQuery ? highlightText(log.tag, searchQuery) : log.tag}
                    </span>
                  )}
                  {!log.tag && <span style={{ width: "150px" }}></span>}
                  
                  <span className="text-white flex-1 whitespace-nowrap" style={{ minWidth: 0 }}>
                    {searchQuery ? highlightText(log.message, searchQuery) : log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}