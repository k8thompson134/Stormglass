import { useState, useEffect, useRef } from "react";
import { geocodeSearch, type GeoResult } from "../services/api";

// Debounced city/ZIP search, shared between Settings.tsx's "Change Location" panel
// and Onboarding.tsx's location step -- both used to hand-roll a near-identical
// 300ms-debounce-plus-stale-response-guard implementation.
export function useGeocodeSearch(query: string) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef("");

  useEffect(() => {
    latestQueryRef.current = query;

    if (query.length < 2) {
      setResults([]);
      setSearchError(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const res = await geocodeSearch(query);
        // A slower, now-superseded request can resolve after a newer
        // one -- only apply results if this effect run is still current.
        if (latestQueryRef.current !== query) return;
        setResults(res);
      } catch {
        if (latestQueryRef.current === query) {
          setResults([]);
          // Distinct from "no matching city" -- a failed request must not look
          // identical to a legitimate empty search result.
          setSearchError(true);
        }
      }
      if (latestQueryRef.current === query) setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const clearResults = () => setResults([]);

  return { results, searching, searchError, clearResults };
}
