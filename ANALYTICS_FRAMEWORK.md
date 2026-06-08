# Privacy-Respecting Analytics Framework

## Philosophy

Stormglass collects minimal analytics data focused on **understanding what works** without **tracking who you are**. We never sell data, share with third parties, or use invasive tracking methods.

---

## What We Track (Currently)

### Zero Tracking (Today)

Currently, Stormglass does **not** implement any analytics. All usage happens locally in your browser; we only see aggregated weather/symptom data when logs are explicitly created.

### What We Plan to Add (Opt-In)

When we add analytics in the future, we will:
- **Ask first:** In-app notification with clear opt-in (not pre-checked)
- **Show what:** Tell you exactly what we're collecting
- **Stay anonymous:** No tracking IDs, user profiles, or cross-device tracking
- **Keep it minimal:** Only metrics that inform product decisions

**Examples of future metrics we'd track (anonymously):**
- Which conditions are most commonly selected (to prioritize features)
- Which UI sections get used most (to improve design)
- Where users get stuck (to reduce friction)
- Browser/device breakdown (to plan support)
- Error frequency (to fix bugs)

**We would NOT track:**
- ❌ Individual user behavior over time
- ❌ Which buttons you click
- ❌ How long you spend on features
- ❌ Symptom data patterns
- ❌ Your location beyond aggregate "region"
- ❌ Personal identifiers of any kind

---

## How Privacy-Respecting Analytics Works

### Anonymization
- **No user IDs:** We don't track "User 12345" across sessions
- **Aggregate only:** "50% of users selected migraines" not "Kate selected migraines"
- **No linking:** Can't connect your symptom logs to your feature usage
- **Random session IDs:** Each visit gets a temporary, random ID; not stored long-term

### Data Minimization
- **Count what matters:** Event counts (e.g., "500 symptom logs created today")
- **Skip the details:** Don't need to know which specific symptoms
- **Short retention:** Keep aggregate stats for 6 months; delete old data
- **No profiles:** Never build a database of "this user does X, Y, Z"

### Transparency
- **Public dashboard:** Usage stats anyone can view (at stormglass.app/analytics)
- **Clear documentation:** Link to this page in settings
- **User choice:** Toggle analytics on/off anytime

---

## What We Do With Analytics Data

### Product Decisions
- **Feature priorities:** "People with EDS are underrepresented; let's highlight joint pain tracking"
- **Design improvements:** "80% abandon settings modal at the location field; redesign needed"
- **Bug fixes:** "Error rate spiked when pressure data is delayed; improve error messaging"

### Performance & Reliability
- **Server capacity:** "Symptom logging peaks at 10pm UTC; scale accordingly"
- **API health:** "Open-Meteo API returning errors 5% of the time; add fallback"
- **Mobile optimization:** "60% of users are on mobile; test more aggressively on small screens"

### Accessibility
- **Feature usage gaps:** "Keyboard users get stuck at condition selection; fix tab order"
- **Adoption of improvements:** "After dark mode update, 40% adoption in first week; working well"

### Community Transparency
- **Public reports:** "Q2 2026: 5,000 symptom logs created, most popular: migraines (35%), POTS (28%)"
- **Research:** Share anonymized patterns with chronic illness researchers (with opt-in from users)

---

## What We Will NOT Do

- ❌ Sell or share data with advertisers
- ❌ Use data for machine learning profiling
- ❌ Build detailed user profiles
- ❌ Track users across other websites
- ❌ Combine data with third-party data (social media, health records, etc.)
- ❌ Use dark patterns to trick users into analytics
- ❌ Change terms to enable tracking without notice
- ❌ Keep analytics data longer than necessary
- ❌ Monetize user behavior

---

## How to Control Your Analytics

### Opt-Out Anytime
- Settings → Privacy → Toggle "Share usage analytics" OFF
- We'll stop collecting data immediately
- Existing data is deleted within 30 days

### Check Your Status
- Settings → Privacy section shows:
  - Whether analytics is on/off
  - Last analytics sync date
  - How many events we've collected (since you enabled it)

### Request Your Data
- Email: privacy@stormglass.app
- We'll send you a CSV of all analytics events we have for you within 7 days

### Delete Your Analytics Data
- Toggle off in Settings, or
- Email: privacy@stormglass.app with subject "Delete my analytics data"
- Deleted within 30 days

---

## Technical Implementation (Future)

When we implement analytics, we'll use:

### Local Processing (Privacy-First)
- Aggregate data locally before sending to server
- Never send individual event logs
- Batch events to minimize requests

### No Third-Party Vendors
- **Not using:** Google Analytics, Mixpanel, Segment, Amplitude
- **Why:** These companies track users across the web
- **Instead:** Simple, in-house analytics (counts, aggregates only)

### Secure Transmission
- HTTPS encryption in transit
- Minimal data retention on server
- Automatic deletion after retention period

### Open Source Consideration
- We may open-source our analytics code
- Community can audit and improve it
- Transparency through code

---

## GDPR & Global Privacy Laws

### GDPR (EU Users)
✅ **Compliant:**
- Anonymous data ≠ personal data under GDPR
- No tracking pixels or cookies for analytics
- Users can opt-out anytime
- Full data deletion available

### CCPA (California Users)
✅ **Compliant:**
- No "sale" of personal information
- Right to know what we collect (see this doc)
- Right to delete (can opt-out anytime)
- No discrimination for opting out

### PIPEDA (Canada)
✅ **Compliant:**
- Minimal personal data collection
- Clear consent before tracking
- User control over data
- Secure storage

---

## Community Involvement

We're building this WITH chronic illness communities, not just FOR them.

### User Research
- **Surveys:** "What features matter most?" (anonymous, opt-in)
- **Interviews:** "How do you use Stormglass?" (paid; ~$50)
- **Bug reports:** "This doesn't work" (voluntary)

### Sharing Results
- Monthly blog post: "What we learned this month"
- Quarterly report: Anonymous usage patterns & improvements
- Annual summary: Community impact & feature roadmap

### Data for Research
- **Opt-in program:** Contribute to scientific research (completely anonymous)
- **Researchers get:** Aggregate symptom patterns by condition
- **You get:** Your data helps validate how weather affects chronic illness
- **Academic papers:** "Barometric pressure correlations in fibromyalgia" with community acknowledgment

---

## Questions?

- **Analytics questions:** privacy@stormglass.app
- **Data deletion:** support@stormglass.app
- **Research participation:** research@stormglass.app

---

## Summary

| Aspect | Status | Details |
|---|---|---|
| Third-party tracking | ❌ None | No Google Analytics, no cookies |
| User profiling | ❌ No | Only aggregates, no profiles |
| Data sharing | ❌ No | Never sold or shared |
| Opt-out | ✅ Yes | Toggle on/off anytime |
| Transparency | ✅ Yes | Public dashboard, this document |
| Deletion | ✅ Yes | Request anytime |
| GDPR compliant | ✅ Yes | Anonymous data, user control |
| Community research | ✅ Opt-in | Share patterns with researchers |

We believe transparency and control are fundamental rights. If we ever implement something that violates these principles, call us out — and we'll fix it.
