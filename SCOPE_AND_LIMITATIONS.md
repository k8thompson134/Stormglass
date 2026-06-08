# Scope & Limitations

## What Stormglass Does

Stormglass is a **personal weather-health pattern tracking tool** for people with chronic conditions. It helps you:

- 📍 **See real-time weather** for your location (pressure, temperature, humidity, wind, precipitation)
- 🌍 **Monitor environmental factors** (air quality, pollen, geomagnetic activity)
- 📊 **Log and track symptoms** with timestamps and environmental snapshots
- 🔍 **Discover patterns** between weather and your symptoms
- 📈 **Forecast health risk** for the next 7 days based on predicted conditions
- 📚 **Understand triggers** for conditions like migraines, POTS, fibromyalgia, ME/CFS, and others

---

## What Stormglass Does NOT Do

### ❌ NOT a Medical Device
- Does NOT diagnose conditions
- Does NOT prescribe treatments
- Does NOT replace doctor visits
- Does NOT provide medical advice
- **Not FDA-approved or HIPAA-compliant**

→ **Always consult healthcare providers** for diagnosis, treatment, and medical decisions.

### ❌ NOT a Substitute for Professional Care
- Does NOT monitor vital signs (heart rate, blood pressure, temperature)
- Does NOT detect emergencies
- Does NOT provide medication reminders
- Does NOT track medication effectiveness

→ **Use dedicated medical apps or devices** for vital sign monitoring.

### ❌ NOT Real-Time Health Alerts
- Does NOT send emergency alerts
- Does NOT provide acute symptom warnings
- Does NOT replace alert systems for serious conditions (severe asthma, anaphylaxis, etc.)

→ **Keep your emergency contacts and medical devices ready** at all times.

### ❌ NOT a Science Guarantor
- Does NOT guarantee weather causes your symptoms
- Does NOT prove cause-and-effect relationships
- Does NOT account for all factors affecting your health (stress, sleep, diet, medications, etc.)
- Does NOT replace rigorous medical research

→ **Use the app to form hypotheses, then discuss with your doctor.**

---

## Supported Conditions

Stormglass currently tracks 13 conditions based on research about weather sensitivities:

### ✅ Conditions We Support

| Condition | Tracked Factors | Data Source |
|---|---|---|
| **Migraines** | Pressure, light (forecast only) | NOAA, Open-Meteo |
| **Cluster Headache** | Pressure, light (forecast only) | NOAA, Open-Meteo |
| **Sinus / Sinusitis** | Pressure, humidity, pollen | NOAA, Open-Meteo, Pollenation |
| **POTS / Dysautonomia** | Temperature, pressure changes | NOAA, Open-Meteo |
| **ME/CFS / PEM** | Barometric volatility (pressure swings) | NOAA |
| **Fibromyalgia** | Pressure, humidity, cold | NOAA, Open-Meteo |
| **Joint Pain (Arthritis)** | Pressure, humidity | NOAA, Open-Meteo |
| **EDS / Hypermobility** | Temperature changes | Open-Meteo |
| **Raynaud's Syndrome** | Cold temperatures, wind | Open-Meteo |
| **Sleep Quality** | Pressure, temperature, light cycles | NOAA, Open-Meteo |
| **Air Quality Sensitivity** | Air Quality Index (AQI), pollution | IQAir |
| **Pollen & Mold Allergies** | Allergen levels (pollen, mold, ragweed) | Pollenation |
| **Geomagnetic Sensitivity** | Solar activity, Kp index | NOAA |

### ❓ Conditions Not Yet Supported

Want tracking for another condition? Email feedback@stormglass.app with:
- Condition name
- Known weather/environmental triggers (with research sources)
- Why it matters to you

We prioritize based on:
1. **Research backing:** Is there published evidence?
2. **Community demand:** How many people asked?
3. **Data availability:** Can we get real-time data?
4. **Technical feasibility:** Can we track it?

### ❌ Out of Scope (Unlikely to Add)

We're unlikely to add support for:
- **Medication tracking** → Use a dedicated pharmacy/medication app
- **Vital signs** (heart rate, blood pressure, oxygen) → Use a health monitor/Apple Health
- **Psychological conditions** → Weather affects mood, but requires mental health expertise we don't have
- **Genetic conditions** (cystic fibrosis, sickle cell, etc.) → Weather may not be primary trigger
- **Infectious disease tracking** (COVID exposure, flu symptoms) → Use public health dashboards
- **Pregnancy/fertility tracking** → Use a dedicated reproductive health app

---

## Data Limitations

### Weather Data Accuracy
- **Forecast accuracy:** 1-3 days (very reliable), 4-7 days (good), beyond that (unreliable)
- **Real-time data:** Updated hourly; may have 15-60min delay from actual conditions
- **Location precision:** We use the city/region you enter; microclimates aren't captured
- **Extreme events:** Localized storms/heat waves may not show in national data

→ **Don't rely solely on app forecasts for planning critical activities.**

### Geomagnetic Data
- **Kp index:** Issued by NOAA Space Weather Prediction Center
- **Lag time:** Published data is typically 6-12 hours behind real time
- **Accuracy:** Predictions are forecasts; actual events vary
- **Coverage:** Global phenomenon; not location-specific

→ **Use app as research tool; geomagnetic sensitivity is still scientifically debated.**

### Pollen Data
- **Coverage:** Not available in all regions (currently US-focused)
- **Delay:** Data is typically 1-2 days behind real time
- **Accuracy:** Based on regional monitoring; hyperlocal variation exists
- **Allergens:** Covers common allergens but not comprehensive

→ **Cross-reference with local pollen counts from allergy clinics.**

### Air Quality
- **Coverage:** Global but sparse in some regions
- **Refresh rate:** Typically 1-3 hours
- **Index choice:** We use US EPA standards; varies globally
- **Causation:** AQI shows pollution; doesn't prove health impact for you

→ **Combine with personal tracking; air quality affects people differently.**

---

## What You Should Track Yourself

Stormglass doesn't (and shouldn't) track these factors; **you should note them when logging symptoms:**

- 🥗 **Diet changes** (caffeine, sugar, specific foods)
- 😴 **Sleep quality** (hours slept, wake times, insomnia)
- 😰 **Stress levels** (work deadlines, life events, emotional triggers)
- 💊 **Medications/supplements** (timing, dose changes, new meds)
- 🏃 **Activity level** (exercise, overexertion, rest days)
- 👥 **Social factors** (isolation, social events, family time)
- 🌙 **Menstrual cycle** (if relevant; period timing can affect many conditions)
- 🍺 **Alcohol consumption**
- 🚭 **Smoke/air pollution exposure** (fires, secondhand smoke)
- 🎵 **Environmental sensitivities** (noise, light, crowds)

→ **Use the app's "notes" field when logging symptoms to capture these factors.**

---

## Conditions With Mixed Evidence

Some conditions have limited research on weather triggers. We support them anyway because:
1. Users reported personal experience with weather links
2. Biological plausibility exists
3. We want to help people test hypotheses

**But be cautious:**
- ⚠️ **EDS/Hypermobility:** Some research on temperature; mixed evidence overall
- ⚠️ **Raynaud's:** Temperature is clear; other factors less studied
- ⚠️ **Geomagnetic sensitivity:** Anecdotal reports; limited peer-reviewed evidence

→ **These are for your personal pattern tracking, not validated scientific claims.**

---

## What NOT to Do With This App

### ❌ Don't Use for Emergencies
- 🚨 Chest pain, severe headache, difficulty breathing → **CALL 911**
- 🚨 Can't reach healthcare provider → **Use emergency services**
- 🚨 Medication overdose/poisoning → **Call Poison Control**
- 🚨 Suicidal thoughts → **Call 988 (US) or local crisis line**

→ **This app is for pattern tracking, not emergency response.**

### ❌ Don't Use Instead of Doctor Visits
- Persistent symptoms → See a doctor
- New conditions → Get evaluated by a professional
- Medication concerns → Talk to your pharmacist/prescriber
- Worsening symptoms → Contact your healthcare team

→ **Stormglass supports self-understanding, not self-diagnosis or self-treatment.**

### ❌ Don't Share Your Logs With Insurance Companies Without Legal Advice
- Your symptom logs are personal research, not medical records
- Sharing with insurers could have unintended consequences
- **Consult a lawyer if you're considering sharing with insurance**

→ **Keep logs for your own use and healthcare conversations.**

### ❌ Don't Rely on Weather Forecasts Alone for Planning
- Forecasts are probabilistic, not guaranteed
- Personal factors (stress, sleep) matter more than weather some days
- Extreme events happen unexpectedly
- Backup plans are essential

→ **Use app insights alongside your own judgment and experience.**

---

## Accuracy & Reliability Disclaimers

### We Make Our Best Effort To
- ✅ Keep data sources up to date
- ✅ Parse weather data correctly
- ✅ Provide accurate forecasts (via Open-Meteo)
- ✅ Fix bugs when found
- ✅ Notify you of outages

### We Can't Guarantee
- ❌ 100% uptime (servers occasionally go down)
- ❌ Perfect accuracy (weather science has inherent uncertainty)
- ❌ No bugs (we'll fix them, but they may exist)
- ❌ Data portability if we shut down (we'll give 90-day notice to export)
- ❌ Future feature compatibility (we may deprecate or redesign)

### If Something Breaks
- **Report it:** Email support@stormglass.app or GitHub issues
- **We'll prioritize:** Bugs affecting core functionality get fixed first
- **We'll communicate:** Updates on status.stormglass.app (coming soon)

---

## Data Gaps & Future Improvements

### Currently Limited
- **Light exposure:** Can't measure actual light; using sunrise/sunset only
- **Humidity:** Available but not all regions well-covered
- **Wind patterns:** Basic data; gusts/variability not detailed
- **Pressure tendencies:** Showing absolute pressure; trending would be better

### Coming (Not Promised)
- Real-time pollen grain counts (if data becomes available)
- Humidity triggers per condition (researching now)
- Historical pattern analysis (see if "last Tuesday was bad" pattern repeats)
- Export as PDF/CSV for doctor visits
- Integrations with habit tracking apps

---

## Geographic Limitations

### Where We Work Well
- 🌍 **Any location with a city name** (auto-geocoding)
- 📍 **Anywhere with weather data** (most of world)
- 🏘️ **Urban areas** (best data coverage)

### Where We Work Less Well
- 🏔️ **Mountains/high elevation** (weather varies dramatically)
- 🏜️ **Remote areas** (sparse data; may have gaps)
- 🌊 **Coastal areas** (microclimates; ocean effects not captured)
- 🪴 **Islands** (may have very limited data)

→ **App works best in major cities; results less reliable in remote areas.**

---

## Summary: Use Stormglass For

✅ **Personal weather-health research**  
✅ **Identifying YOUR patterns** (may differ from general research)  
✅ **Conversations with healthcare providers**  
✅ **Understanding triggers for self-management**  
✅ **Hope** (recognizing patterns can be empowering)

## Don't Use Stormglass For

❌ **Medical diagnosis**  
❌ **Treatment decisions without doctor input**  
❌ **Emergency response**  
❌ **Proof of causation**  
❌ **Insurance/disability claims** (without legal advice)

---

## Questions About Scope?

- **Want to track a new condition?** → feedback@stormglass.app
- **Found data that seems wrong?** → support@stormglass.app
- **Curious about research?** → See HEALTH_MODELS_RESEARCH.md
- **Thinking about medical/legal use?** → Consult a professional first

---

## Final Word

Stormglass is a tool **made by someone with chronic illness, for people with chronic illness**. We understand the frustration of not knowing why you have a flare. We built this to help you understand YOUR body better—not to replace the expertise of your healthcare team.

Use it wisely, share insights with your doctor, and take care of yourself. 🌩️
