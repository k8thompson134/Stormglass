import { useState, useEffect } from "react";
import {
  fetchSettings,
  updateLocation,
  type GeoResult,
} from "../../services/api";
import { useGeocodeSearch } from "../../hooks/useGeocodeSearch";

interface Props {
  open: boolean;
  onLocationChanged: () => void;
}

export default function LocationSettings({ open, onLocationChanged }: Props) {
  const [query, setQuery] = useState("");
  const [currentLat, setCurrentLat] = useState("");
  const [currentLon, setCurrentLon] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [settingsLoadError, setSettingsLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const { results, searching, searchError, clearResults } =
    useGeocodeSearch(query);

  // Load current settings
  useEffect(() => {
    if (open) {
      setSettingsLoadError(false);
      fetchSettings()
        .then((s) => {
          setCurrentLat(s.latitude);
          setCurrentLon(s.longitude);
          if (s.name) setCurrentName(s.name);
        })
        .catch((err) => {
          console.error("Failed to load settings:", err);
          setSettingsLoadError(true);
        });
    }
  }, [open]);

  const selectLocation = async (result: GeoResult) => {
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    try {
      const formattedName = `${result.name}${result.state ? `, ${result.state}` : ""}`;
      await updateLocation(
        String(result.latitude),
        String(result.longitude),
        formattedName,
        result.timezone ?? undefined,
      );
      setCurrentLat(String(result.latitude));
      setCurrentLon(String(result.longitude));
      setCurrentName(`${formattedName}, ${result.country}`);
      setQuery("");
      clearResults();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onLocationChanged();
    } catch (err) {
      console.error("Failed to update location:", err);
      // A failed save must say so -- leaving nothing here would look identical
      // to the save succeeding but the UI just not bothering to confirm it.
      setSaveError(true);
    }
    setSaving(false);
  };

  return (
    <>
      {/* Current Location */}
      <div>
        <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
          Current Location
        </label>
        <div className="bg-[#0f172a] rounded-xl p-4 border border-[#1e2d45] space-y-1.5">
          {settingsLoadError ? (
            <p className="text-[11px] text-amber-300">
              Couldn't load your current location — check your connection and
              try reopening Settings.
            </p>
          ) : currentName ? (
            <div className="text-white text-sm font-semibold">
              {currentName}
            </div>
          ) : (
            <>
              <div className="text-gray-300 text-sm font-semibold">
                Default location
              </div>
              <p className="text-[11px] text-amber-300">
                Stormglass is using a built-in default location. Use{" "}
                <span className="font-semibold">Change Location</span> below to
                set your own.
              </p>
            </>
          )}
          {!settingsLoadError && (
            <div className="text-[10px] text-gray-500 font-mono">
              {currentLat}°N, {currentLon}°W
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div>
        <label
          htmlFor="location-search"
          className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2"
        >
          Change Location
        </label>
        <div className="relative">
          <input
            id="location-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by city or ZIP code..."
            className="w-full bg-[#0f172a] text-white text-sm rounded-xl px-4 py-3 border border-[#1e2d45] focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 placeholder-gray-600 transition-colors"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Results dropdown */}
        {results.length > 0 && (
          <div className="mt-2 bg-[#0f172a] border border-[#1e2d45] rounded-xl overflow-hidden">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => selectLocation(r)}
                disabled={saving}
                className="w-full text-left px-4 py-3 hover:bg-blue-500/10 transition-colors border-b border-[#1e2d45] last:border-b-0 group disabled:opacity-50"
              >
                <div className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">
                  {r.name}
                </div>
                <div className="text-[10px] text-gray-300 mt-0.5">
                  {r.state ? `${r.state}, ` : ""}
                  {r.country}
                  <span className="text-gray-500 ml-2 font-mono">
                    {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}°
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {query.length >= 2 &&
          !searching &&
          results.length === 0 &&
          (searchError ? (
            <div className="mt-2 text-amber-300 text-xs px-1">
              Search failed — check your connection and try again
            </div>
          ) : (
            <div className="mt-2 text-gray-500 text-xs px-1">
              No results found
            </div>
          ))}

        {/* Location save status -- shown right where the action happened,
                    not below the long health-factors list further down the modal. */}
        <div aria-live="polite" className="mt-2">
          {saved && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <span>✓</span>
              <span>Location updated — fetching new data...</span>
            </div>
          )}

          {saving && (
            <div className="flex items-center gap-2 text-blue-400 text-xs bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
              <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <span>Updating location...</span>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <span>⚠</span>
              <span>Couldn't save location — try again</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
