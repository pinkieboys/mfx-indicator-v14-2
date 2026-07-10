# MFX Indicator V14.2 Hosted Backend

This version is prepared to solve local DNS blocking by moving market-data requests to a hosted backend.

## Local run

npm.cmd install
cd backend
npm.cmd install
cd ..
npm.cmd run dev

Open http://127.0.0.1:5173

## Hosted setup

Read `DEPLOY_RENDER.md`.

After Render gives you a backend URL, create `.env` in the main folder:

VITE_API_URL=https://YOUR-BACKEND-NAME.onrender.com

Then restart:

npm.cmd run dev

V14.2 keeps the provider fallback:
Binance -> Bybit -> OKX -> MEXC
