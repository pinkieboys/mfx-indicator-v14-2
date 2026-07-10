# Deploy MFX Backend to Render

1. Upload the complete `mfx_indicator_v14_2` folder to a GitHub repository.
2. In Render, choose **New +** then **Blueprint**.
3. Connect the GitHub repository.
4. Render reads `render.yaml` and deploys the backend.
5. Copy the backend URL, for example:

https://mfx-indicator-api.onrender.com

6. Create a file named `.env` in the main project folder:

VITE_API_URL=https://mfx-indicator-api.onrender.com

7. Restart the website:

npm.cmd run dev

8. Demo Login, open Chart, select BTCUSDT or BCHUSDT, then Generate Signal.

The website will now call the hosted backend instead of exchange APIs from your laptop.
