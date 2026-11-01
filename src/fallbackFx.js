const axios = require("axios");

// 하나은행 조회가 실패했을 때만 쓰는 대체 소스 (유럽중앙은행 참고환율, 무료/무인증)
const BASE = "https://api.frankfurter.dev/v1";

async function get(url, params) {
  const res = await axios.get(url, {
    params,
    timeout: 10000,
    validateStatus: (s) => s < 500,
  });
  if (res.status >= 400) throw new Error(`대체 환율 API 오류 (status ${res.status})`);
  return res.data;
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function getFallbackSnapshot(code, days = 10) {
  const t0 = Date.now();
  const mult = code === "JPY" ? 100 : 1;

  const [latestData, series] = await Promise.all([
    get(`${BASE}/latest`, { base: code, symbols: "KRW" }),
    get(`${BASE}/${isoDaysAgo(Math.max(days * 3, 20))}..${isoDaysAgo(0)}`, {
      base: code,
      symbols: "KRW",
    }),
  ]);

  const raw = latestData?.rates?.KRW;
  if (typeof raw !== "number") throw new Error("대체 환율 데이터를 가져오지 못했습니다.");

  const history = Object.entries(series?.rates || {})
    .filter(([, v]) => typeof v?.KRW === "number")
    .map(([date, v]) => ({ date, rate: v.KRW * mult }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-days);

  return {
    source: "fallback",
    code,
    unit: mult,
    basic: raw * mult,
    cashBuy: null,
    cashSell: null,
    wireSend: null,
    wireReceive: null,
    date: latestData.date,
    round: null,
    time: null,
    history,
    fetchMs: Date.now() - t0,
    cacheHit: false,
  };
}

module.exports = { getFallbackSnapshot };
