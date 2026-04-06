# 🌍 Darukaa Mission Control

> **Conservation analytics platform** — geospatial intelligence for carbon, biodiversity, and vegetation monitoring.

![Stack](https://img.shields.io/badge/stack-FastAPI%20%7C%20React%20%7C%20PostGIS%20%7C%20Mapbox-1a9f76?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Interactive Map** | Mapbox GL JS v3 with polygon site drawing, hover states, and globe projection |
| **Timeline Slider** | Animated 24-month scrubber with play/pause, year ticks, and per-site vitality rendering |
| **Analytics Panel** | Carbon stock, biodiversity index, and NDVI time-series charts with Chart.js 4 |
| **Executive Summary** | One-click consulting-grade view: key metrics, risk signals, and recommendations |
| **Predict Next 6 Months** | Linear regression extrapolation with dashed forecast overlay on any metric chart |
| **Compare Sites** | Side-by-side metric comparison with overlaid mini charts and delta indicators |
| **GeoJSON Upload** | Drag-drop upload of `.geojson` polygon files — instantly rendered on the map |
| **Rule-based Insights** | Threshold engine flags carbon decline, biodiversity plateaus, and NDVI stress |

---

## 🗂 Project Structure

```
darukaa-mission-control/
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── main.py            # ASGI entry point, CORS, router registration
│   │   ├── api/               # Route handlers (projects, sites, analytics, auth)
│   │   ├── models/            # SQLAlchemy ORM models (PostGIS geometry columns)
│   │   ├── schemas/           # Pydantic v2 request/response schemas
│   │   ├── services/          # Business logic (insights.py rule engine)
│   │   └── db/                # Async engine, session factory, Alembic migrations
│   └── .env                   # DATABASE_URL, SECRET_KEY, CORS_ORIGINS
│
├── frontend/                  # React 18 + Vite application
│   ├── src/
│   │   ├── api/               # Axios client + typed API wrappers
│   │   ├── components/
│   │   │   ├── charts/        # TimelineSlider (play/pause, vitality)
│   │   │   ├── layout/        # Navbar
│   │   │   ├── map/           # MapView (Mapbox), DrawControls, SaveSiteModal
│   │   │   └── panels/        # SiteAnalyticsPanel, CompareSitesPanel
│   │   ├── pages/             # Dashboard, MapExplorer, Login, Register
│   │   ├── store/             # Zustand store (sites, selectedSiteId, timelineDate)
│   │   └── main.jsx           # React root, React Router v6
│   └── .env                   # VITE_API_BASE_URL, VITE_MAPBOX_TOKEN
│
└── docker-compose.db.yml      # PostgreSQL 16 + PostGIS container
```

---

## 🚀 Getting Started

### 1. Database (Docker)
```bash
docker compose -f docker-compose.db.yml up -d
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
$env:PYTHONPATH = "C:\path\to\darukaa-mission-control\backend"
python -m uvicorn app.main:app --port 8001 --reload
```
API will be available at `http://localhost:8001`. Interactive docs: `http://localhost:8001/docs`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
App available at `http://localhost:5173`.

### Environment files

**`backend/.env`**
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/darukaa
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
CORS_ORIGINS=["http://localhost:5173"]
```

**`frontend/.env`**
```
VITE_API_BASE_URL=http://localhost:8001
VITE_MAPBOX_TOKEN=<your Mapbox public token>
```

---

## 🧠 Engineering Decisions

### 1. PostGIS for geometry storage — not a GeoJSON column
Raw GeoJSON could be stored in a `jsonb` column, but PostGIS gives us spatial indexing, bounding-box queries, and future reprojection support at zero application-level cost. The geometry arrives from the API pre-serialised as GeoJSON via `ST_AsGeoJSON`, so the frontend never deals with WKB.

### 2. Zustand for global state — not Redux or Context
The state surface is small: `sites[]`, `selectedSiteId`, `timelineDate`, `drawMode`. Zustand provides this with zero boilerplate and first-class selector subscriptions. Context would trigger full-tree re-renders on every timeline tick; Redux would require ~4× the file count for equivalent functionality.

### 3. Feature-state vitality over re-rendering GeoJSON
When the timeline advances, we call `map.setFeatureState({ vitality })` per site rather than re-uploading the entire GeoJSON source. This means zero layout recalculations on the Mapbox thread — only the fill-opacity paint expression re-evaluates, which happens on the GPU.

### 4. Linear regression projection — not a black-box ML model
The "Predict next 6 months" feature uses ordinary least squares on the last 8 data points per metric. This is **explainable, deterministic, and requires no inference server**. It deliberately avoids the false precision of neural forecasting on a dataset of ~24 monthly records.

### 5. Rule-based insights engine — not LLM inference
The `insights.py` service applies deterministic threshold rules (carbon < 50 t/ha → critical, biodiversity plateau detection via 3-month variance < 3%). This produces **reproducible, auditable** outputs. It is the correct choice for a regulated conservation context where insight provenance matters.

### 6. JWT stored in localStorage + httpOnly cookie hybrid
JWTs are currently stored in `localStorage` for development simplicity. The token retrieval is isolated to `api/client.js`, so migrating to `httpOnly` cookies is a one-file change. CORS is configured to `allow_credentials=True` in preparation.

### 7. Direct `bcrypt` — not passlib
`passlib`'s `bcrypt` handler broke with `bcrypt >= 4.x` due to a version sniff that returned `$2b$` hashes the library couldn't re-verify. Switching to `bcrypt.hashpw` / `bcrypt.checkpw` directly removed the abstraction layer that was causing silent failures.

### 8. Vite over Create React App
CRA is no longer maintained and defaults to Webpack 4 (~8s cold start). Vite's native ESM dev server starts in <300ms and produces smaller production bundles via Rollup. The HMR boundary precision also avoids full-page reloads on component edits.

### 9. GeoJSON upload is client-side only — no backend round-trip
Uploaded polygons are added directly to the Mapbox `map` instance as a new source/layer. This avoids a multipart upload endpoint, server-side file parsing, and the associated error surface. If a user wants to persist a feature, they use the existing polygon-draw → save flow.

---

## 📊 Data Model

```
users          ← JWT auth, bcrypt passwords
  └── projects ← workspace per user
        └── sites  ← PostGIS Polygon geometries, site_type enum
              └── site_analytics ← time-series rows (metric_name, value, observed_on)
```

All foreign keys are UUIDs. `site_analytics` is indexed on `(site_id, metric_name, observed_on)` for time-range queries.

---

## 🔐 Security Notes

- Passwords hashed with bcrypt (12 rounds)
- All routes (except `/auth/*`) require Bearer JWT
- CORS origin list is explicit (no wildcard)
- Mapbox token is env-injected at build time — never committed to source
- SQL queries are parameterised via SQLAlchemy ORM (no raw string interpolation)

---

## 🗺 Roadmap

- [ ] Vercel (frontend) + Render (backend) deployment
- [ ] WebSocket live alerts when a metric crosses a threshold
- [ ] PDF export of the Executive Summary view
- [ ] Multi-user project sharing with role-based access
- [ ] Satellite imagery tile overlay (NDVI raster)
