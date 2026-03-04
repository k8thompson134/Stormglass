# Minimal-Prompt Fix Flow for Review Items

Use this so you only need one or two standard prompts to fix everything from a code review, without re-listing items.

---

## 1. Fix Plan in the review output

**Update your review command** so the report always ends with a **Fix Plan** table in this format:

```markdown
## Fix Plan (execute in order)

Use this section when the user says "fix review items" or "execute the fix plan". One row per actionable item.

| ID | Severity | File(s) | Action |
|----|----------|---------|--------|
| 1 | High | frontend/src/main.tsx | Gate SW console behind import.meta.env.DEV |
| 2 | Medium | frontend/src/components/ErrorBoundary.tsx | Add role="alert" on error container |
| 3 | Medium | backend | Add backend/.env.example with vars from env.ts |
```

- Only include items **fixable in code** (or in a doc file). Skip "document in runbook" unless you add a docs path.
- Order: Critical → High → Medium. Skip Low unless the user asks.
- Short IDs: 1, 2, 3 (or F1, F2, F3).

Then a follow-up prompt can be: **"Fix all items in the Fix Plan above"** and the model has the full list.

**Add to your review command (Output Format):**

After "## Priority Fix List", add:

```
## Fix Plan (execute in order)

| ID | Severity | File(s) | Action |
|----|----------|---------|--------|
[List each actionable finding as a row. Critical first, then High, then Medium. File(s) = path(s). Action = one-line what to do.]
```

---

## 2. Standard prompts (minimal typing)

Use one of these so you never have to list items by hand:

| You say | What the AI does |
|--------|-------------------|
| **"Fix review items"** or **"Fix from review"** | Reads `docs/REVIEW_REMAINING.md`, fixes every **unchecked** item in the Checklist (or only Critical/High/Medium). After each fix, marks it `[x]` in REVIEW_REMAINING. Does not ask "which items?" — the checklist is the source of truth. |
| **"Fix the fix plan"** or **"Execute the fix plan"** | Reads the Fix Plan table from the last review (in chat or from `docs/review-latest.md`). Fixes each row in order. Then updates REVIEW_REMAINING (mark done or add to "Already addressed"). |

So after a review you only say: **"Fix review items"** or **"Fix the fix plan"**.

---

## 3. Single source of truth

- **Review run** → Write full report to **`docs/review-latest.md`** (or paste there). It must include the **Fix Plan** table at the end.
- **Review run** → Update **`docs/REVIEW_REMAINING.md`**: add new findings to the tables and set the **Checklist** to match (unchecked for new items).
- **Fix run** → AI reads only:
  - **REVIEW_REMAINING.md** when you say "fix review items" (Checklist + tables), or
  - **Fix Plan** in `review-latest.md` (or last message) when you say "fix the fix plan".

One place for "what's left" (REVIEW_REMAINING) and one for "what to do next in order" (Fix Plan).

---

## 4. Cursor rule (optional, for zero extra prompt)

Add a rule so that when you say "fix review items", the AI knows what to do without you explaining.

**File:** `.cursor/rules/review-fixes.mdc` (or add to project rules)

```markdown
---
description: When the user asks to fix review items, use REVIEW_REMAINING and Fix Plan without asking for clarification.
globs:
alwaysApply: false
---

# Review fix flow

When the user says any of:
- "fix review items"
- "fix from review"
- "fix priority list"
- "fix the fix plan"
- "execute the fix plan"

then:

1. Read `docs/REVIEW_REMAINING.md`. If the user said "fix the fix plan" or "execute the fix plan", also read `docs/review-latest.md` for the Fix Plan table (or use the Fix Plan from the last assistant message if it was a review report).
2. Determine scope:
   - "Fix review items" / "fix from review" / "fix priority list" → fix all **unchecked** items in the Checklist (or all Critical + High + Medium from the tables).
   - "Fix the fix plan" / "execute the fix plan" → fix each row of the Fix Plan table in order.
3. For each item: implement the fix, then update REVIEW_REMAINING (mark the checklist item `[x]` or add to "Already addressed"). Do not ask "which items?" — use the doc as the list.
4. If an item is unclear or not fixable in code (e.g. "document in runbook"), skip it and note in the reply. Otherwise fix without asking for confirmation unless the change is large or risky.
```

Set `alwaysApply: false`. Cursor can suggest this rule when you type "fix review" or you @-mention it.

---

## 5. Summary

| Change | Purpose |
|--------|---------|
| Review output includes a **Fix Plan** table (ID, Severity, File(s), Action) | One prompt "fix the fix plan" gives the AI the full list. |
| REVIEW_REMAINING has a Checklist as the single "what's left" doc | One prompt "fix review items" = work through unchecked items. |
| Standard prompts: "Fix review items" and "Fix the fix plan" | No re-listing; no "fix L3, L9, L12". |
| Cursor rule for those phrases | AI reads the right doc and fixes in order without extra questions. |
