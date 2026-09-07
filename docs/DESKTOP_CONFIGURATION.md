# Desktop Runtime Configuration Schema

Chainscope desktop now uses a runtime configuration schema with per-feature toggles and secret-backed credentials.

## Secret keys

The desktop vault schema supports the following required keys used by services and relays:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `ACLED_ACCESS_TOKEN`
- `WINGBITS_API_KEY`
- `WS_RELAY_URL`
- `VITE_OPENSKY_RELAY_URL`
- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`
- `AISSTREAM_API_KEY`
- `VITE_WS_RELAY_URL`

## Feature schema

Each feature includes:

- `id`: stable feature identifier.
- `requiredSecrets`: list of keys that must be present and valid.
- `enabled`: user-toggle state from runtime settings panel.
- `available`: computed (`enabled && requiredSecrets valid`).
- `fallback`: user-facing degraded behavior description.

## Desktop secret storage

Desktop builds persist secrets in OS credential storage through Tauri command bindings backed by Rust `keyring` entries (`chainscope` service namespace).

Secrets are **not stored in plaintext files** by the frontend.

## Degradation behavior

If required secrets are missing/disabled:

- Summarization: Groq/OpenRouter disabled, browser model fallback.
- FRED / EIA: economic and oil analytics return empty state.
- Cloudflare / ACLED: outages/conflicts return empty state.
- Wingbits: flight enrichment disabled, heuristic-only flight classification remains.
- AIS / OpenSky relay: live tracking features are disabled cleanly.
