# Future task: Location-compare mode

**Status:** Scoped, not started. Skipped at user's choice during the 2026-07-21 AQI/smoke
work ("not wanted right now"). Extracted here before deleting the testing-plan doc it
originated in, since it's a real unstarted idea, not one superseded by later work.

## The idea

A recurring real use case: comparing current location's AQI against a candidate
destination before deciding whether a trip is worth it (e.g. "is it worth driving
somewhere with better air today"). The backend already has the lat/lon-based
Open-Meteo call — a second optional lat/lon param on `/current` (or a new lightweight
`/compare` endpoint) that runs the same fetch against a second location would let the
frontend show a side-by-side without duplicating logic. Doesn't need PurpleAir
hyperlocal for the comparison location — model-only is fine for a decision at that
distance.
