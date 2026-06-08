# Stormglass Privacy Policy

**Effective Date:** May 2026  
**Last Updated:** May 12, 2026

## Overview

Stormglass is designed with privacy-first principles. We collect minimal data, store it securely, and never sell or share your information. This policy explains exactly what data we collect, how we use it, and your rights.

---

## What Data We Collect

### Data We Store on Our Servers
1. **Symptom Logs** (when you choose to log)
   - Severity rating (1-10)
   - Symptom tags you select
   - Optional notes you write
   - Timestamp
   - Environmental snapshot (weather/air quality data at time of log)

2. **Location Settings** (optional)
   - City/state/country name
   - Latitude/longitude coordinates
   - Used only to fetch local weather data

3. **Your Selected Conditions**
   - Which health conditions you track (e.g., migraines, POTS, fibromyalgia)
   - Stored to personalize your health impact view

### Data We Do NOT Collect or Store
- ❌ Your name, email, phone number, or identity
- ❌ Browsing history or IP address
- ❌ Device information or hardware details
- ❌ Geolocation tracking beyond the location you enter
- ❌ Third-party tracking cookies
- ❌ Credit card or payment information (app is free)

### Data We DON'T Store but You Control
- **Health Toggle Preferences** (conditions you track)
- **Onboarding State** (whether you've completed setup)
- These are stored **locally in your browser** using localStorage and never sent to our server.

---

## Data Storage & Security

### Where Your Data Lives
- **Symptom logs & location settings:** Encrypted database on Railway (our hosting provider)
- **Local preferences:** Your browser's localStorage (never leaves your device)
- **API responses:** Weather/air quality data is real-time; not archived

### Security Measures
- ✅ HTTPS encryption for all data in transit
- ✅ Bearer token authentication (API token required to access data)
- ✅ Rate limiting to prevent abuse
- ✅ Database access restricted to necessary backend services
- ✅ No public API access to personal data
- ✅ Regular security reviews

### What We Don't Do
- ❌ Share data with third parties (no analytics vendors, no data brokers)
- ❌ Sell or monetize your data
- ❌ Track you across other websites
- ❌ Store more data than necessary
- ❌ Use your data for purposes beyond the app's functionality

---

## Third-Party Data Sources

Stormglass uses public APIs to fetch environmental data. **We do not share your location or personal data with these services.** We only fetch publicly available weather/environmental data for the location you specify:

- **NOAA (National Oceanic and Atmospheric Administration)** — Barometric pressure, geomagnetic storm data
- **Open-Meteo** — Temperature, humidity, wind, precipitation forecasts
- **IQAir** — Air quality index (AQI) data
- **Pollenation API** — Pollen and mold forecasts

These APIs may log that a request came from our server (not from you personally). They do not receive your symptom logs, health conditions, or any personal data.

---

## Your Rights & Control

### Access & Download
You can access your symptom logs and location settings through the app at any time. (Feature coming: one-click export as CSV/JSON)

### Delete Your Data
- **Delete individual logs:** Click the delete button on any symptom entry
- **Delete all data:** Request via [support email] and we'll permanently delete all your logs and settings within 30 days
- **Delete your account:** Email support@stormglass.app; we'll remove all traces of your account

### Data Retention
- **Symptom logs:** Kept until you delete them
- **Location settings:** Kept until you change them
- **Onboarding state:** Cleared if you reset your browser localStorage
- **Server logs:** Kept for 30 days (for debugging only, not linked to personal data)

---

## HIPAA & Medical Data

**Important Disclaimer:** Stormglass is NOT a medical device and is NOT HIPAA-compliant. It is a personal research and pattern-tracking tool.

- ⚠️ Do not use Stormglass as a substitute for professional medical advice
- ⚠️ Symptom logs are not medical records
- ⚠️ Share results with your doctor, but don't rely solely on app insights
- ⚠️ If you need HIPAA compliance, use a certified medical app instead

If you have serious health concerns, contact your healthcare provider immediately.

---

## Children & Minors

Stormglass is designed for adults managing chronic health conditions. We do not knowingly collect data from children under 13. If you believe we've collected data from a child, please contact us immediately at support@stormglass.app.

Teens (13-17) may use the app with parental consent, but:
- Parents should understand data collection practices
- Symptom logs are stored and visible in the app
- Location settings should be set by a parent/guardian if privacy is a concern

---

## Changes to This Policy

We may update this policy as the app evolves. We'll notify you of significant changes via:
- In-app notification
- Update to this document with new "Last Updated" date

Continued use of the app after changes means you accept the new policy.

---

## Contact Us

**Questions about privacy?**  
Email: support@stormglass.app

**Want to request data deletion?**  
Email: support@stormglass.app with subject "Data Deletion Request"

**Found a security vulnerability?**  
Email: security@stormglass.app (we take security seriously and will respond within 48 hours)

---

## Summary for People in a Hurry

- **We collect:** Symptom logs, location, selected health conditions
- **We store:** Only data you create; encrypted, never shared
- **You control:** Access to your data; you can delete anytime
- **We protect:** With HTTPS, authentication, and rate limiting
- **We don't:** Sell data, track you, or use cookies
- **Not medical:** Use alongside professional healthcare, not as replacement

**Bottom line:** We built Stormglass for ourselves and our communities. We respect your privacy and would never do anything with your data we wouldn't be okay with for our own families.
