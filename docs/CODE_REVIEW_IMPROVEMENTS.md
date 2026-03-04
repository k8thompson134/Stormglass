# Improving Your Code Review Skill

Suggestions to better fit your workflow and make reviews more thorough. Use what fits; ignore the rest.

---

## 1. Workflow fit

### When to run

- **Pre-PR / pre-merge:** Run the full review before opening a PR (or before merging to `main`). Treat it as a gate.
- **After big features:** Run a **scoped** review on only the files you changed (see “Scoped reviews” below).
- **Before release:** Run the full review again and re-check that previous findings are fixed (e.g. against `docs/REVIEW_REMAINING.md`).

**Suggestion:** Add a short “When to use” note at the top of your review command so you (and the AI) know the default trigger (e.g. “Run before merging to main or before cutting a release”).

### Scoped vs full review

Your command says “read every source file.” That’s strong for a full pre-deploy pass but heavy for a single feature.

**Add a scoped mode** to the command, e.g.:

- **Full review:** All phases, entire codebase (current behavior).
- **Scoped review:** Same phases, but only under `frontend/src/` and `backend/src/` for **files changed in the last N commits** (e.g. `git diff --name-only main...HEAD` or `HEAD~3..HEAD`). Skip “read every file”; only read changed files and their direct imports.

Example instruction you could add:

```markdown
**Scope (choose one):**
- **Full:** Review entire codebase (default). Use when preparing for release or merge to main.
- **Scoped:** Review only files changed in the last 3 commits. List them with `git diff --name-only HEAD~3..HEAD` and run the same phases only on those paths. Use for feature PRs.
```

That keeps the same checklist but makes it faster and more relevant for day-to-day PRs.

### Tie-in with REVIEW_REMAINING.md

You already have `docs/REVIEW_REMAINING.md` as a living list. Tighten the loop:

- At the **end** of the review command, add: “Append any new **Critical/High/Medium** findings to `docs/REVIEW_REMAINING.md` in the appropriate table, and add a **Priority Fix List** section if not already present.”
- Optionally: “If the verdict is **Fix First** or **Do Not Ship**, ensure each blocking finding has a row in REVIEW_REMAINING with a concrete action.”

That way the same doc drives both the review and the follow-up fixes (like you did for L6, M1, etc.).

### One report, one place

- Keep a **single** report per run (e.g. `docs/review-YYYY-MM-DD.md` or paste into the PR description).
- Add to the command: “If saving to a file, use a consistent path (e.g. `docs/review-latest.md`) so the team knows where to look.”

---

## 2. More thorough checks

### Phase 1 (Security): add explicit patterns

Your phases are already good. To make them more repeatable and less dependent on the model’s mood, add **concrete grep-style patterns** the reviewer must run (and report “no matches” or list matches). For example:

```markdown
**Required searches (run and report):**
- `password|secret|api[_-]?key|token\s*=\s*['\"]` in source (exclude .env, .env.example, *.md).
- `dangerouslySetInnerHTML|innerHTML\s*=` in frontend.
- `eval\(|new Function\(` in source.
- `exec\(|spawn\(|execSync` in backend.
- Raw SQL: `\.query\s*\(\s*['\"]\s*SELECT|INSERT|UPDATE|DELETE` without parameterization (adapt to your ORM).
```

You can tune these to your stack (e.g. Drizzle has no raw `.query` strings, so you might search for `sql` template usage and manual concatenation instead). The point is: **explicit searches → consistent coverage**.

### Phase 2 (Performance): project-specific list

Add a short **project-specific** sub-checklist so the reviewer doesn’t miss your hot paths. For Stormglass, for example:

```markdown
**Project-specific:**
- Weather poll job: are external API calls parallelized where possible? (e.g. Promise.all)
- History API: is there a LIMIT (or equivalent) on time-series queries?
- Frontend: are there large lists (e.g. >50 items) rendered without virtualization or pagination?
- Any `setInterval`/`addEventListener` that might not be cleared on unmount?
```

You can copy this pattern for other projects (different endpoints, different frameworks).

### Phase 4 (A11y): concrete targets

To avoid vague “check contrast” and “check keyboard”:

- **Contrast:** “List every use of `text-gray-500`, `text-gray-600`, `text-gray-700` (and equivalent) on dark backgrounds (e.g. `bg-gray-900`, `bg-[#131d2e]`). Flag as MEDIUM if used for body/label text.”
- **Keyboard:** “For every custom control (modal, dropdown, tab list), confirm: (1) focus trap in modals, (2) Escape closes, (3) Tab cycles within the control.”
- **Forms:** “Every `<input>`/`<select>`/`<textarea>` must have a visible `<label>` or `aria-label` (or `aria-labelledby`). List any that don’t.”

That way the report either lists specific files/lines or states “no issues found.”

### Phase 7 (Deployment): require commands

Make Phase 7 **actionable** by requiring the reviewer to run (or tell the user to run) and report:

- `npm run build` in frontend and backend (success/failure and first 20 lines of output if failed).
- `npm audit --production` (or `npm audit`) in backend and frontend; report critical/high and “0” if none.
- Optional: “List the exact steps to run a fresh migration (e.g. `npm run db:migrate`) and whether the README matches.”

That turns “verify build” into “run build and report result.”

### New phase (optional): “Tests & robustness”

If you care about tests and failure paths:

- **Tests:** Are there tests for critical paths (e.g. weather API, auth, health)? If not, say so and rate as MEDIUM/LOW.
- **Error paths:** For key user flows (e.g. “load dashboard”, “change location”), is there a visible error state (not just console)?
- **Loading states:** Do main views show loading instead of blank or stale data?

You can add this as Phase 8 and keep the same output format.

---

## 3. Command tweaks you can paste in

### At the top (workflow)

```markdown
**When to use:** Before merging to main or before a release. For a single feature PR, prefer "Scoped" (see Scope below).

**Scope:**
- **Full (default):** All source under frontend/src and backend/src. Run every phase.
- **Scoped:** Only files changed in the last 3 commits. Run: `git diff --name-only HEAD~3..HEAD` (or main...HEAD), filter to frontend/src and backend/src, then run the same phases but only read those files and their direct imports. State "Scoped review" and list the files in the report.
```

### In Phase 1 (security)

```markdown
**Required searches (report "no matches" or list file:line):**
- Secrets: grep for `password|secret|api_key|apiKey|token\s*=\s*['\"]` in .ts,.tsx,.js,.jsx (exclude .env*, *.md, node_modules).
- XSS: grep for `dangerouslySetInnerHTML|innerHTML\s*=` in frontend.
- Eval: grep for `eval\(|new Function\(` in source.
```

### At the end (follow-up)

```markdown
**After the report:**
- If verdict is Fix First or Do Not Ship: add each Critical/High (and optionally Medium) finding to `docs/REVIEW_REMAINING.md` with a concrete action, or confirm it already exists there.
- Append a **Priority Fix List** (top 5–10 items with file paths) to the report.
```

---

## 4. Checklist summary

| Goal | Change |
|------|--------|
| Fit workflow | Add “When to use” and Full vs Scoped mode; tie report to REVIEW_REMAINING.md. |
| Consistent security | Add required grep-style searches in Phase 1 and “report no matches or list”. |
| Consistent performance | Add a short project-specific sub-checklist (poll, history API, lists, timers). |
| Actionable a11y | Require listing gray-on-dark and form labels; require focus trap/Escape/Tab check for custom controls. |
| Actionable deployment | Require running build and npm audit and reporting success/failure. |
| Optional depth | Add Phase 8 (tests, error states, loading states). |

**Minimal-prompt fix flow:** See **`docs/FIX_FLOW_MINIMAL_PROMPTS.md`** for one-prompt fixing (Fix Plan table, standard prompts, optional Cursor rule).

You can copy the “Command tweaks” section into your `.claude/commands/review-code.md` and adjust the paths/patterns to match each project.
