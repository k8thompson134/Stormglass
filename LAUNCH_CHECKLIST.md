# Stormglass Community Launch Checklist

## ✅ Completed: Onboarding & Accessibility Improvements

### Onboarding Experience
- [x] Added welcome step (Step 0) explaining what Stormglass does
- [x] Improved condition hints to be user-friendly (e.g., "Tracks pressure drops that trigger attacks" instead of "Barometric pressure changes")
- [x] Added "How it works" explainer box on welcome step
- [x] Three-step flow: Welcome → Conditions → Location

### Accessibility Fixes
- [x] Fixed text contrast: upgraded secondary text from gray-400/gray-500 to gray-300
- [x] Added ARIA labels to header buttons (Log symptom, View symptom log, Open settings)
- [x] Added ARIA labels to location search inputs (htmlFor on labels, id on inputs)
- [x] Added Escape key handler to Settings modal
- [x] Added progress bar role to step indicator
- [x] Added aria-pressed states to condition buttons
- [x] Improved form label associations
- [x] Added helpful hints visible on condition buttons themselves

---

## 🔲 Pre-Launch Checklist

### Testing (Before posting in communities)

#### Manual Testing
- [ ] Test onboarding on real iPhone/Android (mobile first - chronically ill users often browse from bed)
- [ ] Tab through entire app with keyboard - verify all buttons/links are reachable
- [ ] Press Escape in Settings modal - verify it closes
- [ ] Screen reader test on Mac (VoiceOver):
  - [ ] Listen to welcome step - does it explain the app clearly?
  - [ ] Navigate through condition selection - are hints readable?
  - [ ] Test location search - labels associated correctly?
- [ ] Test on Windows with NVDA (if you have access)
- [ ] Test dark mode toggling (system setting)
- [ ] Verify charts/data visualizations have text descriptions

#### Edge Cases
- [ ] Test with very long location names
- [ ] Test with all conditions selected/deselected
- [ ] Test with no internet (PWA offline mode)
- [ ] Test on slow connection (simulate 3G)
- [ ] Test on small phone screen (320px width)
- [ ] Verify form inputs work with password managers (they shouldn't, but test defaults)

#### Browser Compatibility
- [ ] Chrome (desktop + mobile)
- [ ] Safari (desktop + iOS)
- [ ] Firefox (desktop + mobile)

---

### Content & Community Readiness

#### Copy & Messaging
- [ ] Verify all placeholder text is removed
- [ ] Check for typos/grammar in welcome, hints, and buttons
- [ ] Verify location warning message is clear ("Using default location")
- [ ] Check that error messages are helpful (not technical jargon)

#### Disclaimers & Trust
- [ ] Add "About" page explaining:
  - What the app does (and doesn't do)
  - That it's not medical advice
  - Research backing the health impact model
  - Who it's built for (chronic illness communities)
- [ ] Add "Data Sources" page showing:
  - Open-Meteo API
  - NOAA Space Weather
  - Tomorrow.io (if enabled)
  - Transparency about data collection (none - all client-side)
- [ ] Add privacy policy if required by jurisdiction
- [ ] Add terms of service if monetizing

#### Community Feedback
- [ ] Create feedback form link in Settings (already linked to Google Form ✓)
- [ ] Create way for users to share their stories/experiences
- [ ] Document known limitations:
  - Requires location to work (no GPS - manual entry only)
  - Pollen/allergen data requires Tomorrow.io API key
  - Forecast accuracy depends on NOAA/Open-Meteo data quality

---

### Mobile & Performance

#### Responsive Design
- [ ] Settings modal fits on small screens
- [ ] Onboarding buttons don't overflow
- [ ] Pressure chart readable on mobile (not too compressed)
- [ ] Header icon buttons have adequate touch target (44px minimum) ✓

#### Performance
- [ ] First Contentful Paint < 2s on 3G
- [ ] PWA installs as app on iOS/Android
- [ ] Offline mode works (cached data visible)
- [ ] API calls are debounced (300ms for location search ✓)
- [ ] No console errors or warnings

#### Dark Mode
- [ ] App looks good with system dark mode ON
- [ ] App looks good with system dark mode OFF
- [ ] Colors maintain contrast in all modes

---

### Marketing & Documentation

#### README Updates
- [ ] Add screenshot showing welcome screen
- [ ] Add GIFs showing onboarding flow
- [ ] Document keyboard shortcuts (if any)
- [ ] Add troubleshooting section:
  - "Why is my location showing as default?"
  - "How do I export my data?"
  - "Can I use this offline?"

#### Community Posting Strategy
- [ ] Identify target subreddits (r/migraine, r/POTS, r/cfs, r/Fibromyalgia, r/EDS, etc.)
- [ ] Prepare intro post with:
  - What problem it solves
  - 3 features (pressure tracking, health forecasts, symptom logging)
  - Link to demo or website
  - Invitation for feedback
- [ ] Prepare for common questions:
  - "Is this a medical device?" → No, awareness tool only
  - "How is this different from weather apps?" → Tracks health-specific factors
  - "Is my data safe?" → All client-side, no server storage
  - "Can I use offline?" → Yes, with cached data
  
---

### Final Sign-Off

**Checklist Owner:** Kate Thompson  
**Target Launch Date:** [TBD]  
**Status:** 🟢 Onboarding & Accessibility Complete

**Next Steps:**
1. Test on actual devices (mobile priority)
2. Create/update About & Data Sources pages
3. Add feedback form integration
4. Post in 2-3 community forums as beta
5. Iterate based on feedback
6. Expand to more communities

---

## Notes for Community Managers

When posting in chronic illness communities:

1. **Lead with empathy:** "I built this because weather triggers my own migraines..."
2. **Be honest about limitations:** "This isn't medical advice, but it helps me understand my patterns"
3. **Encourage feedback:** "What would make this more useful for YOUR condition?"
4. **Watch for gatekeeping:** Some communities may be skeptical of external tools - respect that
5. **Offer customization:** Highlight that they can choose which conditions to track
6. **Share use cases:** "I use this to plan social events around low-risk weather days"

