
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = "https://mfx-backend.onrender.com";

const markets = [
  { symbol: "BINANCE:BTCUSDT", name: "BTCUSDT", label: "Bitcoin" },
  { symbol: "BINANCE:BCHUSDT", name: "BCHUSDT", label: "Bitcoin Cash" },
  { symbol: "OANDA:XAUUSD", name: "XAUUSD", label: "Gold" },
  { symbol: "FX:EURUSD", name: "EURUSD", label: "Euro / Dollar" },
  { symbol: "FX:GBPUSD", name: "GBPUSD", label: "Pound / Dollar" }
];

const timeframes = ["1M", "5M", "15M", "1H", "4H", "1D"];

function App() {
  const [page, setPage] = useState("chart");
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("mfx_user") || "null"));

  function loginDemo() {
    const demo = {
      username: "mfx_tester",
      name: "MFX Tester",
      plan: "Free Trial",
      level: "Beginner"
    };
    localStorage.setItem("mfx_user", JSON.stringify(demo));
    setUser(demo);
  }

  function logout() {
    localStorage.removeItem("mfx_user");
    setUser(null);
  }

  return (
    <div>
      <Header page={page} setPage={setPage} user={user} loginDemo={loginDemo} />
      {page === "home" && <Home setPage={setPage} />}
      {page === "chart" && <Chart user={user} loginDemo={loginDemo} />}
      {page === "profile" && <Profile user={user} loginDemo={loginDemo} logout={logout} />}
      {page === "history" && <History />}
      {page === "learning" && <Learning />}
      <footer>© 2026 MFX Indicator V14.2 Hosted Backend</footer>
    </div>
  );
}

function Header({ page, setPage, user, loginDemo }) {
  return (
    <header className="topbar">
      <div className="brand" onClick={() => setPage("home")}>
        <div className="brandMark">MFX</div>
        <div>
          <b>MFX Indicator</b>
          <small>V14.2 Hosted Backend</small>
        </div>
      </div>

      <nav>
        {["home", "chart", "learning", "history", "profile"].map((item) => (
          <button key={item} className={page === item ? "navActive" : ""} onClick={() => setPage(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {user ? (
        <button className="ghost" onClick={() => setPage("profile")}>@{user.username}</button>
      ) : (
        <button className="primary" onClick={loginDemo}>Demo Login</button>
      )}
    </header>
  );
}

function Home({ setPage }) {
  return (
    <main className="hero">
      <section>
        <p className="pill">AI Trading Platform Foundation</p>
        <h1>MFX Indicator is now becoming a real full-stack app.</h1>
        <p>
          V14.2 connects a React frontend with a Node.js backend, preparing the app for real AI signals,
          users, payments, history, and live market analysis.
        </p>
        <div className="actions">
          <button className="primary" onClick={() => setPage("chart")}>Open Chart</button>
          <button className="ghost" onClick={() => setPage("learning")}>Learning Center</button>
        </div>
      </section>

      <section className="heroCard">
        <p className="pill">System Status</p>
        <h2>Frontend + Backend</h2>
        <p>Ready for testing with backend API connection.</p>
      </section>
    </main>
  );
}

function Chart({ user, loginDemo }) {
  const [market, setMarket] = useState(markets[0]);
  const [tf, setTf] = useState("1M");
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("Checking backend...");

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then((d) => setApiStatus(d.ok ? "Backend Online" : "Backend Error"))
      .catch(() => setApiStatus("Backend Offline"));
  }, []);

  useEffect(() => {
    setSignal(null);
    loadTradingView(market.symbol, tf);
  }, [market, tf]);

  async function runAI() {
    if (!user) {
      alert("Please demo login first.");
      loginDemo();
      return;
    }

    const key = `mfx_v14_signal_${market.symbol}_${tf}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      setSignal(JSON.parse(cached));
      return;
    }

    setLoading(true);
    setSignal(null);

    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: market.symbol, timeframe: tf, user: user.username })
      });

      const data = await res.json();

      if (!data.ok) {
        setSignal({ error: true, message: data.message });
      } else {
        localStorage.setItem(key, JSON.stringify(data.signal));
        setSignal(data.signal);
        saveHistory(data.signal);
      }
    } catch (e) {
      setSignal({ error: true, message: "Backend offline. Run npm run dev first." });
    }

    setLoading(false);
  }

  return (
    <main className="chartLayout">
      <aside className="watchlist">
        <h3>Markets</h3>
        {markets.map((m) => (
          <button key={m.symbol} className={market.symbol === m.symbol ? "market active" : "market"} onClick={() => setMarket(m)}>
            <span>{m.name}</span>
            <small>{m.label}</small>
          </button>
        ))}

        <div className={apiStatus === "Backend Online" ? "status ok" : "status bad"}>{apiStatus}</div>
      </aside>

      <section className="chartPanel">
        <div className="panelHead">
          <div>
            <h2>{market.name} Chart</h2>
            <p>TradingView is used for display. Hosted backend uses Binance, Bybit, OKX, then MEXC fallback for AI analysis.</p>
          </div>
        </div>

        <div className="timeframes">
          {timeframes.map((t) => (
            <button key={t} className={tf === t ? "tf active" : "tf"} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>

        <div className="tvBox">
          <div id="tradingview_box"></div>
        </div>
      </section>

      <aside className="aiPanel">
        <h2>AI Agent</h2>
        <p className="small">One signal per market + timeframe.</p>
        <button className="primary full" onClick={runAI} disabled={loading}>
          {loading ? "Analyzing..." : "Generate Signal"}
        </button>

        {signal && <SignalCard signal={signal} />}
      </aside>
    </main>
  );
}

function SignalCard({ signal }) {
  if (signal.error) {
    return (
      <div className="signal error">
        <h3>Live Data Needed</h3>
        <p>{signal.message}</p>
      </div>
    );
  }

  const cls = signal.signal === "BUY" ? "buy" : signal.signal === "SELL" ? "sell" : "wait";

  return (
    <div className="signal">
      <p className="small">{signal.market} • {signal.timeframe}</p>
      <h1 className={cls}>◆ {signal.signal}</h1>
      <p>Confidence: <b>{signal.confidence}%</b> • Setup: <b>{signal.quality}</b></p>

      <div className="signalGrid">
        <div>Entry<br /><b>{signal.entry}</b></div>
        <div>TP<br /><b>{signal.tp}</b></div>
        <div>SL<br /><b>{signal.sl}</b></div>
        <div>RR<br /><b>{signal.rr}</b></div>
      </div>

      <div className="analysis">
        <h3>AI Analysis</h3>
        <p>{signal.analysis}</p>
      </div>

      <div className="signalGrid">
        <div>Trend<br /><b>{signal.trend}</b></div>
        <div>Structure<br /><b>{signal.structure}</b></div>
        <div>RSI<br /><b>{signal.rsi}</b></div>
        <div>Momentum<br /><b>{signal.momentum}</b></div>
      </div>

      <p className="warning"><b>Invalidation:</b> {signal.invalidation}</p>
    </div>
  );
}

function Profile({ user, loginDemo, logout }) {
  if (!user) {
    return (
      <main className="section center">
        <h1>Profile</h1>
        <p>Please login first.</p>
        <button className="primary" onClick={loginDemo}>Demo Login</button>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="profileGrid">
        <section className="card">
          <div className="avatar">{user.username[0].toUpperCase()}</div>
          <h2>@{user.username}</h2>
          <p>{user.name}</p>
          <p className="pill">{user.plan}</p>
          <button className="ghost full" onClick={logout}>Logout</button>
        </section>

        <section className="card">
          <h2>User Info</h2>
          <div className="infoGrid">
            <div>Level<br /><b>{user.level}</b></div>
            <div>Signals<br /><b>{getHistory().length}</b></div>
            <div>Status<br /><b>Tester</b></div>
            <div>Version<br /><b>V14.2</b></div>
          </div>
        </section>
      </div>
    </main>
  );
}

function History() {
  const history = getHistory();

  return (
    <main className="section">
      <h1>Signal History</h1>
      {history.length === 0 ? (
        <p>No signals yet.</p>
      ) : (
        <div className="table">
          <div className="row head"><span>Market</span><span>Signal</span><span>Entry</span><span>TP</span><span>SL</span><span>Time</span></div>
          {history.map((h, i) => (
            <div className="row" key={i}>
              <span>{h.market}</span>
              <span className={h.signal === "BUY" ? "buy" : h.signal === "SELL" ? "sell" : "wait"}>{h.signal}</span>
              <span>{h.entry}</span>
              <span>{h.tp}</span>
              <span>{h.sl}</span>
              <span>{h.time}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Learning() {
  return (
    <main className="section">
      <h1>Learning Center</h1>
      <p>V14.2 keeps this basic. V14.6 will upgrade lessons and reviews.</p>
      <div className="cards">
        {["Forex Basics", "Candlesticks", "Support & Resistance", "Risk Management"].map((x) => (
          <div className="card" key={x}>
            <h2>{x}</h2>
            <p>Course placeholder for future full learning system.</p>
          </div>
        ))}
      </div>
    </main>
  );
}

function loadTradingView(symbol, tf) {
  const box = document.getElementById("tradingview_box");
  if (!box) return;

  box.innerHTML = "";

  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.innerHTML = JSON.stringify({
    autosize: true,
    symbol,
    interval: mapTvInterval(tf),
    timezone: "Asia/Phnom_Penh",
    theme: "dark",
    style: "1",
    locale: "en",
    allow_symbol_change: true,
    calendar: false,
    hide_side_toolbar: false,
    withdateranges: true,
    details: true,
    support_host: "https://www.tradingview.com"
  });

  box.appendChild(script);
}

function mapTvInterval(tf) {
  return { "1M": "1", "5M": "5", "15M": "15", "1H": "60", "4H": "240", "1D": "D" }[tf] || "1";
}

function saveHistory(signal) {
  const history = getHistory();
  history.unshift(signal);
  localStorage.setItem("mfx_history", JSON.stringify(history.slice(0, 50)));
}

function getHistory() {
  return JSON.parse(localStorage.getItem("mfx_history") || "[]");
}

createRoot(document.getElementById("root")).render(<App />);
