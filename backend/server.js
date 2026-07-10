
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(v => v.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json());

const MARKETS = {
  "BINANCE:BTCUSDT": { name: "BTCUSDT", dec: 2, atrBase: 650, s: { binance:"BTCUSDT", bybit:"BTCUSDT", okx:"BTC-USDT", mexc:"BTCUSDT" } },
  "BINANCE:BCHUSDT": { name: "BCHUSDT", dec: 2, atrBase: 8, s: { binance:"BCHUSDT", bybit:"BCHUSDT", okx:"BCH-USDT", mexc:"BCHUSDT" } },
  "OANDA:XAUUSD": { name: "XAUUSD", forex: true, dec: 3 },
  "FX:EURUSD": { name: "EURUSD", forex: true, dec: 5 },
  "FX:GBPUSD": { name: "GBPUSD", forex: true, dec: 5 }
};

app.get("/api/health", (req, res) => {
  res.json({ ok:true, name:"MFX Backend", version:"14.2", providers:["Binance","Bybit","OKX","MEXC"] });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { symbol, timeframe } = req.body;
    const market = MARKETS[symbol];

    if (!market) return res.status(400).json({ ok:false, message:"Unsupported market." });

    if (market.forex) {
      return res.status(400).json({
        ok:false,
        message:`${market.name} is prepared but needs a Forex/Gold candle API in V14.2. Test BTCUSDT or BCHUSDT now.`
      });
    }

    const tf = mapInterval(timeframe);
    const result = await getCandlesAny(market, tf);

    if (!result.candles || result.candles.length < 80) {
      return res.status(400).json({ ok:false, message:`All providers failed. Last error: ${result.lastError || "No data"}` });
    }

    const signal = analyze(result.candles, market, timeframe, result.provider);
    res.json({ ok:true, signal });
  } catch (error) {
    res.status(500).json({ ok:false, message:error.message || "AI backend error." });
  }
});

async function getCandlesAny(market, tf) {
  const providers = [
    ["Binance", () => binance(market.s.binance, tf.binance)],
    ["Bybit", () => bybit(market.s.bybit, tf.bybit)],
    ["OKX", () => okx(market.s.okx, tf.okx)],
    ["MEXC", () => mexc(market.s.mexc, tf.mexc)]
  ];

  let lastError = "";

  for (const [provider, fn] of providers) {
    try {
      const candles = await fn();
      if (candles && candles.length >= 80) return { provider, candles };
      lastError = `${provider}: not enough candles`;
    } catch (e) {
      lastError = `${provider}: ${e.message}`;
      console.log("Provider failed:", lastError);
    }
  }

  return { provider:null, candles:null, lastError };
}

async function binance(symbol, interval) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return d.map(k => candle(k[0], k[1], k[2], k[3], k[4], k[5])).sort((a,b)=>a.time-b.time);
}

async function bybit(symbol, interval) {
  const r = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=200`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!d.result || !Array.isArray(d.result.list)) throw new Error("Invalid response");
  return d.result.list.map(k => candle(k[0], k[1], k[2], k[3], k[4], k[5])).sort((a,b)=>a.time-b.time);
}

async function okx(symbol, interval) {
  const r = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${interval}&limit=200`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!Array.isArray(d.data)) throw new Error("Invalid response");
  return d.data.map(k => candle(k[0], k[1], k[2], k[3], k[4], k[5])).sort((a,b)=>a.time-b.time);
}

async function mexc(symbol, interval) {
  const r = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return d.map(k => candle(k[0], k[1], k[2], k[3], k[4], k[5])).sort((a,b)=>a.time-b.time);
}

function candle(time, open, high, low, close, volume) {
  return { time:Number(time), open:Number(open), high:Number(high), low:Number(low), close:Number(close), volume:Number(volume) };
}

function mapInterval(tf) {
  const map = {
    "1M": { binance:"1m", bybit:"1", okx:"1m", mexc:"1m" },
    "5M": { binance:"5m", bybit:"5", okx:"5m", mexc:"5m" },
    "15M": { binance:"15m", bybit:"15", okx:"15m", mexc:"15m" },
    "1H": { binance:"1h", bybit:"60", okx:"1H", mexc:"60m" },
    "4H": { binance:"4h", bybit:"240", okx:"4H", mexc:"4h" },
    "1D": { binance:"1d", bybit:"D", okx:"1D", mexc:"1d" }
  };
  return map[tf] || map["1M"];
}

function analyze(candles, market, timeframe, provider) {
  const closes = candles.map(c=>c.close);
  const highs = candles.map(c=>c.high);
  const lows = candles.map(c=>c.low);
  const volumes = candles.map(c=>c.volume);
  const last = candles[candles.length-1];

  const ema20 = ema(closes,20), ema50 = ema(closes,50), ema100 = ema(closes,100);
  const rsi14 = rsi(closes,14), atr14 = atr(candles,14);
  const macd = ema(closes,12) - ema(closes,26), macdSig = macdSignal(closes);
  const avgVol = sma(volumes.slice(-30));
  const support = Math.min(...lows.slice(-35)), resistance = Math.max(...highs.slice(-35));
  const mid = (support + resistance) / 2;

  const trend =
    ema20 > ema50 && ema50 > ema100 ? "Strong Bullish" :
    ema20 > ema50 ? "Bullish Pullback" :
    ema20 < ema50 && ema50 < ema100 ? "Strong Bearish" :
    ema20 < ema50 ? "Bearish Pullback" : "Sideways";

  const structure =
    last.close > Math.max(...highs.slice(-12,-2)) ? "Breakout" :
    last.close < Math.min(...lows.slice(-12,-2)) ? "Breakdown" :
    last.close > mid ? "Upper Range" : "Lower Range";

  const body = Math.abs(last.close-last.open);
  const range = Math.max(last.high-last.low, 0.000001);
  const upper = last.high - Math.max(last.open,last.close);
  const lower = Math.min(last.open,last.close) - last.low;

  const candle =
    lower > body*1.3 ? "Buyer rejection wick" :
    upper > body*1.3 ? "Seller rejection wick" :
    last.close > last.open && body/range > .55 ? "Strong bullish candle" :
    last.close < last.open && body/range > .55 ? "Strong bearish candle" : "Neutral candle";

  const momentum = macd > macdSig ? "Bullish" : "Bearish";
  const volume = last.volume > avgVol*1.15 ? "Strong volume" : "Normal volume";

  let buy=0, sell=0;
  if (trend.includes("Bullish")) buy += 3;
  if (trend.includes("Bearish")) sell += 3;
  if (structure === "Breakout") buy += 3;
  if (structure === "Breakdown") sell += 3;
  if (momentum === "Bullish") buy += 2; else sell += 2;
  if (rsi14 > 52 && rsi14 < 70) buy += 2;
  if (rsi14 < 48 && rsi14 > 30) sell += 2;
  if (candle.includes("bullish") || candle.includes("Buyer")) buy += 2;
  if (candle.includes("bearish") || candle.includes("Seller")) sell += 2;
  if (volume === "Strong volume" && last.close > last.open) buy += 1;
  if (volume === "Strong volume" && last.close < last.open) sell += 1;
  if (rsi14 > 72) buy -= 3;
  if (rsi14 < 28) sell -= 3;

  let signal = "WAIT";
  if (buy >= sell + 3 && buy >= 7) signal = "BUY";
  if (sell >= buy + 3 && sell >= 7) signal = "SELL";

  const entry = last.close;
  let sl, tp;
  if (signal === "BUY") {
    sl = Math.min(support, entry - atr14*1.25);
    tp = entry + (entry - sl)*1.8;
  } else if (signal === "SELL") {
    sl = Math.max(resistance, entry + atr14*1.25);
    tp = entry - (sl - entry)*1.8;
  } else {
    sl = entry - atr14;
    tp = entry + atr14;
  }

  const rr = Math.abs(tp-entry) / Math.abs(entry-sl);
  const confidence = signal === "WAIT" ? 60 : Math.min(95, 70 + Math.abs(buy-sell)*4);
  const quality = confidence >= 86 ? "A+" : confidence >= 78 ? "A" : "B";
  const dec = market.dec;

  return {
    time:new Date().toLocaleString(),
    market:market.name,
    timeframe,
    signal,
    confidence,
    quality,
    entry:Number(entry.toFixed(dec)),
    tp:Number(tp.toFixed(dec)),
    sl:Number(sl.toFixed(dec)),
    rr:`1:${rr.toFixed(2)}`,
    trend,
    structure,
    rsi:rsi14.toFixed(1),
    momentum,
    support:support.toFixed(dec),
    resistance:resistance.toFixed(dec),
    invalidation: signal === "BUY" ? `If price closes below ${sl.toFixed(dec)}, the buy idea is invalid.`
      : signal === "SELL" ? `If price closes above ${sl.toFixed(dec)}, the sell idea is invalid.`
      : "No entry because conditions are not strong enough.",
    analysis: signal === "BUY" ? `BUY setup from ${provider}: trend is ${trend}, structure is ${structure}, momentum is ${momentum}, candle is ${candle}, and volume is ${volume}.`
      : signal === "SELL" ? `SELL setup from ${provider}: trend is ${trend}, structure is ${structure}, momentum is ${momentum}, candle is ${candle}, and volume is ${volume}.`
      : `WAIT setup from ${provider}: conditions are mixed. Trend is ${trend}, structure is ${structure}, RSI is ${rsi14.toFixed(1)}, and momentum is ${momentum}.`,
    source:`${provider} live candles`
  };
}

function ema(values, period) { const k=2/(period+1); let r=values[0]; for(let i=1;i<values.length;i++) r=values[i]*k+r*(1-k); return r; }
function rsi(values, period) { let gains=0, losses=0; for(let i=values.length-period;i<values.length;i++){const diff=values[i]-values[i-1]; if(diff>=0) gains+=diff; else losses-=diff;} if(losses===0) return 100; return 100 - 100/(1+gains/losses); }
function atr(candles, period) { const trs=[]; for(let i=candles.length-period;i<candles.length;i++){const c=candles[i], p=candles[i-1]; trs.push(Math.max(c.high-c.low, Math.abs(c.high-p.close), Math.abs(c.low-p.close)));} return trs.reduce((a,b)=>a+b,0)/trs.length; }
function macdSignal(closes) { const lines=[]; for(let i=35;i<closes.length;i++){const part=closes.slice(0,i+1); lines.push(ema(part,12)-ema(part,26));} return ema(lines,9); }
function sma(values) { return values.reduce((a,b)=>a+b,0)/values.length; }

app.listen(PORT, () => {
  console.log(`MFX Backend V14.2 running on http://localhost:${PORT}`);
  console.log("Providers: Binance -> Bybit -> OKX -> MEXC");
});
