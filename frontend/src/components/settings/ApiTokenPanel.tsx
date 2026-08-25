import { useState } from "react";

export default function ApiTokenPanel() {
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenRevealed, setTokenRevealed] = useState(false);

  const apiToken = import.meta.env.VITE_API_TOKEN as string | undefined;

  const copyToken = async () => {
    if (!apiToken) return;
    await navigator.clipboard.writeText(apiToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  return (
    <div className="border-t border-[#1e2d45] pt-5">
      <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
        API Access
      </label>
      <p className="text-[11px] text-gray-300 mb-3">
        Use this token to connect OpenClaw or other apps to your Stormglass
        data.
      </p>
      {apiToken ? (
        <div className="bg-[#0f172a] rounded-xl border border-[#1e2d45] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono text-gray-300 truncate select-all">
              {tokenRevealed
                ? apiToken
                : `${apiToken.slice(0, 6)}${"•".repeat(20)}${apiToken.slice(-4)}`}
            </code>
            <button
              onClick={() => setTokenRevealed((r) => !r)}
              aria-label={tokenRevealed ? "Hide token" : "Reveal token"}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded shrink-0"
            >
              {tokenRevealed ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <button
              onClick={copyToken}
              aria-label="Copy API token"
              className="text-gray-500 hover:text-blue-300 transition-colors p-1 rounded shrink-0"
            >
              {tokenCopied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            Endpoint:{" "}
            <span className="font-mono text-gray-300">
              {window.location.origin}/api/briefing
            </span>
          </p>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-xl border border-amber-500/20 p-3">
          <p className="text-[11px] text-amber-300">
            No API token configured. Set{" "}
            <span className="font-mono">VITE_API_TOKEN</span> in your{" "}
            <span className="font-mono">.env</span> and rebuild.
          </p>
        </div>
      )}
    </div>
  );
}
