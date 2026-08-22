import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  fetchSymptomLogs,
  deleteSymptomLog,
  exportSymptomLogs,
  type SymptomLogEntry,
  type EnvironmentalSnapshot,
} from "../services/api";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { toF } from "../utils/conversions";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SEVERITY_COLORS: Record<number, string> = {
  1: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  2: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  3: "bg-green-500/20 text-green-300 border-green-500/30",
  4: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  5: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  6: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  7: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  8: "bg-red-500/20 text-red-300 border-red-500/30",
  9: "bg-red-500/20 text-red-300 border-red-500/30",
  10: "bg-red-600/25 text-red-300 border-red-500/40",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SnapshotDump({ snapshot }: { snapshot: EnvironmentalSnapshot }) {
  return (
    <div className="font-mono text-[11px] leading-relaxed bg-[#0a0f1a] rounded-lg border border-[#1a2535] p-3 space-y-2 overflow-x-auto">
      {/* Weather */}
      <div>
        <span className="text-cyan-400">## Weather</span>
        <div className="text-gray-300 pl-2">
          <div>
            Pressure:{" "}
            <span className="text-white">
              {snapshot.pressure.toFixed(1)} hPa
            </span>
          </div>
          <div>
            Temperature:{" "}
            <span className="text-white">{toF(snapshot.temperature)}°F</span>{" "}
            <span className="text-gray-500">
              ({snapshot.temperature.toFixed(1)}°C)
            </span>
          </div>
          <div>
            Humidity:{" "}
            <span className="text-white">{snapshot.humidity.toFixed(0)}%</span>
          </div>
          <div>
            Dew Point:{" "}
            <span className="text-white">{toF(snapshot.dewPoint)}°F</span>
          </div>
          <div>
            Wind:{" "}
            <span className="text-white">
              {snapshot.windSpeed.toFixed(1)} m/s
            </span>
          </div>
          <div>
            UV Index:{" "}
            <span className="text-white">{snapshot.uvIndex.toFixed(1)}</span>
          </div>
          <div>
            Cloud Cover:{" "}
            <span className="text-white">
              {snapshot.cloudCover.toFixed(0)}%
            </span>
          </div>
          <div>
            Precipitation:{" "}
            <span className="text-white">
              {snapshot.precipitation.toFixed(1)} mm
            </span>
          </div>
        </div>
      </div>

      {/* Derivatives */}
      {snapshot.derivative && (
        <div>
          <span className="text-cyan-400">## Pressure Derivatives</span>
          <div className="text-gray-300 pl-2">
            <div>
              Δ1h:{" "}
              <span className="text-white">
                {snapshot.derivative.delta1h.toFixed(3)} hPa/h
              </span>
            </div>
            <div>
              Δ3h:{" "}
              <span className="text-white">
                {snapshot.derivative.delta3h.toFixed(3)} hPa/h
              </span>
            </div>
            <div>
              Δ6h:{" "}
              <span className="text-white">
                {snapshot.derivative.delta6h.toFixed(3)} hPa/h
              </span>
            </div>
            <div>
              Trend:{" "}
              <span
                className={
                  snapshot.derivative.trend === "rising"
                    ? "text-red-400"
                    : snapshot.derivative.trend === "falling"
                      ? "text-blue-400"
                      : "text-gray-400"
                }
              >
                {snapshot.derivative.trend}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AQI */}
      {snapshot.aqi && (
        <div>
          <span className="text-cyan-400">## Air Quality</span>
          <div className="text-gray-300 pl-2">
            <div>
              US AQI:{" "}
              <span className="text-white">
                {snapshot.aqi.usAqi.toFixed(0)}
              </span>
            </div>
            <div>
              PM2.5:{" "}
              <span className="text-white">
                {snapshot.aqi.pm25.toFixed(1)} µg/m³
              </span>
            </div>
            <div>
              PM10:{" "}
              <span className="text-white">
                {snapshot.aqi.pm10.toFixed(1)} µg/m³
              </span>
            </div>
            <div>
              Ozone:{" "}
              <span className="text-white">
                {snapshot.aqi.ozone.toFixed(1)} ppb
              </span>
            </div>
            <div>
              NO₂:{" "}
              <span className="text-white">
                {snapshot.aqi.no2.toFixed(1)} ppb
              </span>
            </div>
            <div>
              SO₂:{" "}
              <span className="text-white">
                {snapshot.aqi.so2.toFixed(1)} ppb
              </span>
            </div>
            <div>
              CO:{" "}
              <span className="text-white">
                {snapshot.aqi.co.toFixed(1)} ppb
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Geomagnetic */}
      {snapshot.geomagnetic && (
        <div>
          <span className="text-cyan-400">## Geomagnetic</span>
          <div className="text-gray-300 pl-2">
            <div>
              Kp Index:{" "}
              <span className="text-white">
                {snapshot.geomagnetic.kpIndex.toFixed(1)}
              </span>
            </div>
            <div>
              Solar Wind Speed:{" "}
              <span className="text-white">
                {snapshot.geomagnetic.solarWindSpeed.toFixed(0)} km/s
              </span>
            </div>
            <div>
              Solar Wind Density:{" "}
              <span className="text-white">
                {snapshot.geomagnetic.solarWindDensity.toFixed(1)} p/cm³
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Pollen */}
      {snapshot.pollen && (
        <div>
          <span className="text-cyan-400">## Pollen</span>
          <div className="text-gray-300 pl-2">
            <div>
              Tree:{" "}
              <span className="text-white">{snapshot.pollen.treeIndex}/5</span>
            </div>
            <div>
              Grass:{" "}
              <span className="text-white">{snapshot.pollen.grassIndex}/5</span>
            </div>
            <div>
              Weed:{" "}
              <span className="text-white">{snapshot.pollen.weedIndex}/5</span>
            </div>
            <div>
              Mold:{" "}
              <span className="text-white">{snapshot.pollen.moldIndex}/5</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogEntry({
  entry,
  onDelete,
}: {
  entry: SymptomLogEntry;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const severityClass = SEVERITY_COLORS[entry.severity] || SEVERITY_COLORS[5];

  return (
    <div className="border border-[#1e2d45] rounded-xl bg-[#131d2e]/80 overflow-hidden">
      {/* Summary Row */}
      <div className="p-4 flex items-start gap-3">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${severityClass}`}
        >
          {entry.severity}/10
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 font-mono">
            {formatTimestamp(entry.timestamp)}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {(entry.tags as string[]).map((tag, i) => (
              <span
                key={i}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25"
              >
                {tag}
              </span>
            ))}
          </div>
          {entry.notes && (
            <p className="text-xs text-gray-400 mt-1.5 italic">{entry.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {entry.environmentalSnapshot && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded border border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors"
            >
              {expanded ? "Hide Env" : "Show Env"}
            </button>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-500 hover:text-red-400 transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/10"
              title="Delete"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(entry.id)}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-gray-500 hover:text-gray-400 px-1.5 py-0.5"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Environment Dump */}
      {expanded && entry.environmentalSnapshot && (
        <div className="px-4 pb-4">
          <SnapshotDump snapshot={entry.environmentalSnapshot} />
        </div>
      )}
    </div>
  );
}

export default function SymptomDebugLog({ open, onClose }: Props) {
  const [logs, setLogs] = useState<SymptomLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [days, setDays] = useState(30);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, modalRef, { onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(false);
    fetchSymptomLogs(days)
      .then(setLogs)
      .catch((err) => {
        console.error("Failed to fetch symptom logs:", err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [open, days]);

  const handleDelete = async (id: string) => {
    try {
      await deleteSymptomLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error("Failed to delete symptom log:", err);
    }
  };

  const handleExportJSON = async () => {
    try {
      const allLogs = await exportSymptomLogs(365);
      const dataStr = JSON.stringify(allLogs, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stormglass-symptom-logs-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export logs:", err);
      alert("Failed to export logs");
    }
  };

  const handleExportCSV = async () => {
    try {
      const allLogs = await exportSymptomLogs(365);
      const csvHeader = [
        "Date",
        "Time",
        "Severity",
        "Tags",
        "Notes",
        "Pressure (hPa)",
        "Temperature (°C)",
        "Humidity (%)",
        "AQI",
        "PM2.5",
      ];
      const csvRows = allLogs.map((log) => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString();
        const tags = (log.tags as string[]).join("; ");
        const notes = log.notes || "";
        const snap = log.environmentalSnapshot;
        const pressure = snap?.pressure?.toFixed(1) || "";
        const temp = snap?.temperature?.toFixed(1) || "";
        const humidity = snap?.humidity?.toFixed(0) || "";
        const aqi = snap?.aqi?.usAqi?.toFixed(0) || "";
        const pm25 = snap?.aqi?.pm25?.toFixed(1) || "";
        return [
          dateStr,
          timeStr,
          log.severity,
          `"${tags}"`,
          `"${notes}"`,
          pressure,
          temp,
          humidity,
          aqi,
          pm25,
        ].join(",");
      });
      const csv = [csvHeader.join(","), ...csvRows].join("\n");
      const dataBlob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stormglass-symptom-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export logs:", err);
      alert("Failed to export logs");
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Symptom debug log"
        tabIndex={-1}
        className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 p-5 border-b border-gray-700/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Symptom Log
              </h2>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mt-0.5">
                View and export all symptom data
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center hover:bg-gray-800/50 rounded-lg"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <div className="flex items-center justify-between">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-[#0f172a] border border-[#1e2d45] rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                className="text-[10px] font-bold px-3 py-1.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/60 transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={handleExportCSV}
                className="text-[10px] font-bold px-3 py-1.5 rounded border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 hover:border-green-500/60 transition-colors"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">Loading symptom logs...</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">
                Couldn't load symptom logs
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Check your connection and try again.
              </p>
            </div>
          )}

          {!loading && !loadError && logs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">
                No symptom logs in the last {days} days.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Use the clipboard button in the header to log your first
                symptom.
              </p>
            </div>
          )}

          {!loading &&
            !loadError &&
            logs.map((entry) => (
              <LogEntry key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
        </div>

        {/* Footer */}
        {!loading && logs.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-700/30 text-[10px] text-gray-500 font-mono">
            {logs.length} {logs.length === 1 ? "entry" : "entries"} · last{" "}
            {days} days
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
