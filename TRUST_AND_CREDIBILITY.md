# Trust & Credibility Documentation

## Overview

This document outlines the comprehensive trust and credibility features added to Stormglass to ensure users understand how the app works, what research supports it, where data comes from, and critical limitations.

## New Features

### 1. About Page (`About.tsx`)

A comprehensive modal dialog explaining:

- **Mission & Purpose**: What Stormglass is designed to do and for whom
- **Important Disclaimer**: Clear statement that Stormglass is for awareness only, not medical diagnosis or treatment
- **Health Conditions Tracked**: Detailed explanation of each tracked condition with:
  - What factors trigger or worsen symptoms
  - The physiological basis for the correlation
  - Examples: migraine pressure sensitivity, POTS autonomic overload, joint inflammation from cold/humidity
- **Research Foundation**: Evidence-based references showing why each model is included
  - Migraine & barometric pressure (RCT evidence)
  - Temperature & joint pain (clinical studies)
  - Air quality & respiratory/systemic health (extensive epidemiological data)
  - Sleep & environmental factors (circadian research)
- **How to Use**: Step-by-step guide for users to get the most value
- **What We Don't Do**: Explicit list of limitations and non-claims

**Access**: Click the "ⓘ" (info) button in the header

---

### 2. Data Sources Page (`DataSources.tsx`)

A detailed modal explaining all data sources and transparency:

#### Data Privacy & Local Storage
- All health logs and symptoms stay on the user's device
- No personal health data is sent to servers
- Weather data is fetched but not linked to personal data

#### Weather & Environmental Data Sources

1. **Stormglass Weather API**
   - Source: NOAA, MERRA-2, satellite imagery
   - Update frequency: Every few hours
   - Accuracy: ±1-2 hPa for pressure, ±1-2°C for temperature
   - Data points: Pressure, temperature, humidity, wind, UV, waves

2. **Air Quality Index (AQI)**
   - Source: EPA and regional monitoring stations
   - Coverage: Primarily North America
   - Update frequency: Hourly or every few hours
   - Data points: US AQI, PM2.5, PM10, O₃, NO₂, SO₂, CO

3. **Pollen & Allergen Data**
   - Source: Monitoring networks, satellite imagery, phenology models
   - Data points: Tree, grass, weed pollen indices; mold spore counts
   - Note: Modeled estimates; local variation can be significant

4. **Geomagnetic Activity (Space Weather)**
   - Source: NOAA Space Weather Prediction Center
   - Data points: Kp Index (0–9), solar wind speed/density
   - Update frequency: Real-time (every few minutes)
   - Note: Geomagnetic sensitivity is research-stage; user should validate with own observations

#### Data Limitations & Caveats

1. **Grid Resolution**: Weather data is spatially interpolated (5–25 km resolution)
2. **Forecast Uncertainty**: Accuracy decreases beyond 48 hours
3. **Individual Variation**: Models reflect general patterns, not personal baselines
4. **Multiple Factors**: Symptoms are rarely single-factor; stress, sleep, diet all compound
5. **Geomagnetic Caution**: Link to human health is still being researched

#### Health Impact Model Inputs

A detailed table showing which data points trigger each condition:

- **Migraine**: Pressure change (Δ ≥ ±0.5 hPa/h), sustained shifts
- **Cluster Headache**: Pressure + UV index + temperature extremes
- **Sinus Pressure**: Humidity, temperature, pollen
- **POTS / Dysautonomia**: Heat/cold stress + humidity + pressure (combined)
- **Joint Pain**: Pressure (Δ ≥ ±0.5), cold (<10°C), high humidity
- **Fibromyalgia**: Pressure volatility + cold + humidity
- **EDS**: Temperature extremes + humidity
- **Raynaud's**: Cold (<5°C) + wind speed
- **ME/CFS**: Overall atmospheric volatility
- **Sleep**: Temperature + humidity + geomagnetic + AQI
- **Air Quality**: US AQI (PM2.5, PM10, pollutants)
- **Geomagnetic**: Kp Index
- **Pollen**: Allergen indices

#### Attribution & Further Reading

- PubMed and peer-reviewed journals
- NIH research summaries
- CDC and WHO epidemiological data
- Patient communities and self-reported patterns

#### Feedback & Error Reporting

Email contact for users to report inaccuracies or suggest improvements.

**Access**: Click the "⬚" (database) button in the header

---

## Research & Validation Notes

### Health Models Overview

The models are built from the following research patterns:

#### Barometric Pressure & Migraine
- **Evidence**: Multiple randomized controlled trials
- **Mechanism**: Pressure drops trigger neural inflammation; sustained shifts compound effect
- **Threshold**: Typically ≥0.5 hPa/hour change
- **Validation**: Well-established in neurology literature

#### Temperature & Joint Pain
- **Evidence**: Clinical studies on arthritis populations
- **Mechanism**: Cold increases tissue stiffness; barometric pressure changes affect joint cavity pressure
- **Threshold**: Cold <10°C, humidity >60%
- **Validation**: Widely reported by patients and physicians

#### Humidity & Arthritis
- **Evidence**: Cohort studies
- **Mechanism**: High humidity affects joint fluid dynamics and tissue hydration
- **Threshold**: Humidity >65% correlates with increased pain
- **Validation**: Consistent across multiple populations

#### Air Quality & Health
- **Evidence**: Extensive epidemiological data
- **Mechanism**: PM2.5 penetrates deep lung tissue; systemic inflammation triggered
- **Threshold**: US AQI ≥100 shows measurable health effects
- **Validation**: EPA, WHO, and CDC consensus

#### POTS & Autonomic Stress
- **Evidence**: Autonomic dysfunction literature
- **Mechanism**: Multiple stressors (heat, cold, humidity, pressure) compound dysregulation
- **Threshold**: Combined score ≥3 shows clear effects
- **Validation**: POTS patient communities report weather sensitivity

#### Sleep & Environmental Factors
- **Evidence**: Circadian and sleep science
- **Mechanism**: Temperature, light, geomagnetic disturbances affect melatonin and sleep architecture
- **Threshold**: Temperature <15°C or >28°C; humidity <40% or >70%
- **Validation**: Sleep labs and chronobiology research

---

## Design Principles

### Transparency First
- All data sources are named and explained
- Update frequencies and accuracy limits are disclosed
- Users know exactly what data is stored locally vs. sent to servers

### Evidence-Based, Not Guaranteed
- Models are built on research patterns, not personal predictions
- Users are encouraged to validate patterns with their own experience
- Disclaimers are clear and prominent

### User Privacy
- Zero storage of personal health data on servers
- All symptom logs and conditions stay on device
- Location is used only for weather fetching, never stored

### Accessible Complexity
- Technical details are in the Data Sources page
- Plain-language explanations in the About page
- Conditions are explained with both mechanism and practical impact

---

## Implementation Details

### Files Added

1. **`frontend/src/components/About.tsx`**
   - ~300 lines
   - Comprehensive health condition explanations
   - Research foundation summary
   - Usage instructions and disclaimers

2. **`frontend/src/components/DataSources.tsx`**
   - ~350 lines
   - Data source details and update frequencies
   - Limitations and caveats
   - Health model input table
   - Privacy and feedback information

### Files Modified

1. **`frontend/src/App.tsx`**
   - Added About and DataSources imports
   - Added `aboutOpen` and `dataSourcesOpen` state variables
   - Added info (ⓘ) button to both mobile and desktop headers
   - Added database (⬚) button to both mobile and desktop headers
   - Added About and DataSources modal renderers

### Integration Points

- **Header buttons**: Cyan (ⓘ) for About, Blue (⬚) for Data Sources
- **Keyboard navigation**: Both modals support Escape to close and focus trap
- **Responsive**: Works on mobile, tablet, and desktop
- **Consistent styling**: Matches existing Stormglass design language

---

## Testing Checklist

- [ ] Click info button on mobile—About page opens
- [ ] Click info button on desktop—About page opens
- [ ] Click database button on mobile—Data Sources page opens
- [ ] Click database button on desktop—Data Sources page opens
- [ ] All sections scroll properly on small screens
- [ ] Close buttons (×) work
- [ ] Escape key closes modals
- [ ] Focus is trapped inside modals
- [ ] Links (to stormglassio.com, email) work correctly
- [ ] Disclaimer is prominent and clear
- [ ] Health condition descriptions match user's experience

---

## Future Enhancements

1. **Research References**: Add clickable links to specific PubMed articles or research papers
2. **Condition Deep-Dives**: Individual pages for each health condition with case studies
3. **Data Accuracy Dashboard**: Show which data sources are active and when last updated
4. **User Feedback Loop**: Collect user reports on model accuracy and use to refine thresholds
5. **Peer-Review Badge**: Seek external validation of health models from medical professionals
6. **Accessibility Audit**: Ensure WCAG compliance for all new documentation
7. **Localization**: Translate About and Data Sources pages to other languages
8. **API Documentation**: If creating a public API, document rate limits and data freshness

---

## Disclaimer Template

**For all communications about health impact models:**

> Stormglass is designed for self-awareness and personal health management, not for medical diagnosis or treatment. Environmental factors do correlate with symptom patterns in many chronic conditions, but correlation is not causation, and individual responses vary widely. Always consult a healthcare professional before making decisions about your health. If you experience new or worsening symptoms, seek medical attention immediately.

---

## Contact & Feedback

Users can report inaccuracies, suggest improvements, or request specific research references by emailing:
**katethompson134@gmail.com**

All feedback will be reviewed and used to improve the health models and documentation.
