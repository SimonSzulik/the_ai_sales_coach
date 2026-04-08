# AI Sales Coach

**Q-Summit 2026 Hackathon — Cloover Challenge**

An AI co-pilot that turns a minimal lead (name, address, zip code) into a personalised, data-driven sales briefing for energy installer reps.

Challenge reference: https://cloover-qhack.netlify.app/

## Quick Start

```bash
# 1. Copy and fill in your API key
cp .env.example .env
# Edit .env → set ANTHROPIC_API_KEY

# 2. Start everything
docker compose up --build

# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000/docs
```

### Local development (without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Needs Postgres + Redis running locally (see .env)
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Architecture

```
Input: name + address + zip code
        │
        ▼
  ┌─────────────┐
  │  FastAPI     │  POST /api/lead → background pipeline
  │  Backend     │  GET  /api/lead/{id}/briefing
  └──────┬──────┘
         │
    ┌────┴────┐  Parallel enrichment
    │         │
  ┌─┴──┐ ┌──┴──┐ ┌───────┐ ┌──────────┐
  │Geo │ │Solar│ │Energy │ │Subsidies │
  │Nom.│ │PVGIS│ │SMARD  │ │KfW/BAFA  │
  └─┬──┘ └──┬──┘ └───┬───┘ └────┬─────┘
    └────┬───┘        │          │
         ▼            ▼          ▼
  ┌──────────────────────────────────┐
  │  Deterministic Offer Engine      │
  │  3 tiers × 3 financing options   │
  └──────────────┬───────────────────┘
                 ▼
  ┌──────────────────────────────────┐
  │  Claude Sonnet Sales Coach       │
  │  Talk track, objections, Qs      │
  └──────────────┬───────────────────┘
                 ▼
  ┌──────────────────────────────────┐
  │  Next.js Dashboard               │
  │  6 briefing cards, auto-polling  │
  └──────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12, Pydantic v2 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| AI | Anthropic Claude Sonnet (sales coaching) |
| Enrichment | Nominatim, PVGIS, SMARD, KfW/BAFA rules |
| Infrastructure | Docker Compose |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/lead` | Create lead → triggers background enrichment |
| GET | `/api/lead/{id}` | Get lead status |
| GET | `/api/lead/{id}/briefing` | Get full briefing (202 while processing) |
| GET | `/api/leads` | List recent leads |
| GET | `/api/health` | Health check |

---

## How the Pipeline Works

When a salesperson submits a lead through the frontend form, the following happens:

1. **Frontend** sends `POST /api/lead` with `{ name, address, zip_code, product_interest }`.
2. **Backend** creates a database row (status `"pending"`), returns the lead ID, and launches `run_pipeline(lead_id)` as a background task.
3. **Frontend** navigates to `/lead/{id}` and polls `GET /api/lead/{id}/briefing` every 2 seconds. The backend returns **HTTP 202** while processing, and **HTTP 200** with the full briefing JSON once done.

### Pipeline stages (`backend/app/pipeline.py`)

#### Stage 1 — Parallel Enrichment

Four enrichers run concurrently via `asyncio.gather`:

| Enricher | File | External API | What it fetches |
|----------|------|-------------|-----------------|
| Geocoding | `backend/app/enrichers/geocoding.py` | [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap) | Latitude/longitude, city name, building type from address + zip |
| Solar Potential | `backend/app/enrichers/solar.py` | [EU PVGIS](https://re.jrc.ec.europa.eu/pvg_tools/en/) | Annual kWh/kWp yield, optimal tilt angle/azimuth, monthly breakdown |
| Energy Prices | `backend/app/enrichers/energy_prices.py` | [SMARD](https://www.smard.de) (Bundesnetzagentur) | Wholesale EUR/MWh, calculated retail EUR/kWh, price trend |
| Subsidies | `backend/app/enrichers/subsidies.py` | Static rule engine (no API call) | Matching KfW/BAFA programs, total eligible subsidy in EUR |

After the initial parallel run, if geocoding returned valid coordinates, the solar enricher is re-run with the actual lat/lon for location-specific results.

#### Stage 2 — Opportunity Scoring

A rule-based scorer (`_score()` in `pipeline.py`) computes a 0–100 score:

- Solar yield > 1000 kWh/kWp → +15 points
- Electricity price > 0.30 EUR/kWh → +10 points
- Subsidy total > 3000 EUR → +15 points
- Each enricher's data confidence level adds/subtracts points

#### Stage 3 — Offer Engine

`backend/app/engine/offers.py` builds three deterministic offer tiers using the enriched data:

| Tier | Components | Cost basis |
|------|-----------|-----------|
| **Starter** | 5 kWp solar | 1,400 EUR/kWp |
| **Recommended** | 8 kWp solar + 10 kWh battery | + 800 EUR/kWh for storage |
| **Premium** | 10 kWp solar + 15 kWh battery + heat pump + wallbox | + 15,000 EUR (heat pump) + 1,500 EUR (wallbox) |

`backend/app/engine/financing.py` then computes three financing scenarios per tier:
- **Cash** — full upfront (after subsidy deduction)
- **Partial** — 30% down, rest financed at 3.99% over 15 years
- **Full** — 0% down, 100% financed at 3.99% over 15 years

#### Stage 4 — AI Sales Coach

`backend/app/coach/sales_coach.py` sends all enriched data + computed offers to **Anthropic Claude Sonnet** (`claude-sonnet-4-20250514`) and receives back:

- A **90-second talk track** personalised to the customer
- **Likely objections** with prepared rebuttals
- **Qualifying questions** to ask during the visit
- An **urgency statement** referencing real deadlines or price trends
- A **confidence disclaimer** noting any data assumptions

#### Stage 5 — Persist & Serve

The complete briefing is serialised as JSON into the database. The frontend's polling loop picks it up and renders six dashboard cards: Lead Snapshot (with map), Opportunity Score, Offer Comparison, Financing Table, Sales Coach, and Data Trust.

### External API calls in detail

**Nominatim** (no API key required):
```
GET https://nominatim.openstreetmap.org/search
    ?q={address},{zip_code},Germany
    &format=jsonv2&addressdetails=1&limit=1
Header: User-Agent: AISalesCoach-Hackathon/0.1
```

**EU PVGIS** (no API key required):
```
GET https://re.jrc.ec.europa.eu/api/v5_3/PVcalc
    ?lat={lat}&lon={lon}&peakpower=1&loss=14
    &outputformat=json&pvtechchoice=crystSi
```

**SMARD** (no API key required, two-step):
```
GET https://www.smard.de/app/chart_data/4169/DE/index_hour.json
    → returns list of available timestamps

GET https://www.smard.de/app/chart_data/4169/DE/4169_DE_hour_{timestamp}.json
    → returns hourly wholesale price series
```

**Anthropic Claude** (requires `ANTHROPIC_API_KEY`):
```
POST https://api.anthropic.com/v1/messages
    model: claude-sonnet-4-20250514
    max_tokens: 1500, temperature: 0.7
    system: SYSTEM_PROMPT (see below)
    messages: [{ role: "user", content: enriched context as JSON }]
```

---

## Prompts & Customisation

### Where the prompts are

The AI sales coaching prompt lives in a single location:

**`backend/app/coach/sales_coach.py`** — the `SYSTEM_PROMPT` constant (lines 20–43) controls what the AI generates. The `_build_context()` function (lines 47–84) controls what data the AI receives.

The current system prompt instructs Claude to act as an expert sales coach for German residential energy installations and produce:
- A 90-second conversational talk track (~220 words)
- Realistic objections for German homeowners with rebuttals
- Qualifying questions to uncover missing information
- An urgency statement tied to real deadlines/regulations
- A confidence disclaimer about data assumptions

### How to adjust what the AI researches

**To change what the AI outputs**, edit `SYSTEM_PROMPT` in `sales_coach.py`. For example, to add a customer profile assessment, add a rule like `"- Include a brief customer persona assessment based on the property and location data"` and add a corresponding field to the OUTPUT JSON SCHEMA section. Then update the `SalesCoachOutput` model in `backend/app/models.py` to include the new field.

**To change what data the AI sees**, edit `_build_context()` in `sales_coach.py`. This function assembles a JSON object from all enrichment results. If you add a new enricher, include its data here.

**To add a new data source about the person/house**:

1. Create a new enricher file in `backend/app/enrichers/` following the pattern of the existing ones. Each enricher is an async function that returns an `EnrichmentResult` with `source`, `confidence`, and `data` fields.

2. Add the new result to `EnrichmentBundle` in `backend/app/models.py`.

3. Wire it into `pipeline.py` — add it to the `asyncio.gather()` call and include it in the `EnrichmentBundle` constructor.

4. Add it to `_build_context()` in `sales_coach.py` so the AI can use the new data.

5. Optionally update the scoring rules in `_score()` in `pipeline.py`.

### Subsidy catalog

The subsidy rules are in `backend/app/enrichers/subsidies.py` in the `SUBSIDY_CATALOG` list. Each entry specifies a program name, provider, grant amount, type (`"grant"` or `"low_interest_loan"`), eligible product categories, and optional deadline notes. Update amounts or add new programs directly in this list.

### Offer engine constants

Pricing assumptions are at the top of `backend/app/engine/offers.py`:

| Constant | Value | Meaning |
|----------|-------|---------|
| `PV_COST_PER_KWP` | 1,400 EUR | Cost per kWp of solar PV |
| `BATTERY_COST_PER_KWH` | 800 EUR | Cost per kWh of battery storage |
| `HEAT_PUMP_COST` | 15,000 EUR | Fixed cost for air-source heat pump |
| `WALLBOX_COST` | 1,500 EUR | Fixed cost for 11 kW EV charger |

Adjust these to match current market prices.
