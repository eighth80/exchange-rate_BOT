const axios = require("axios");
const cheerio = require("cheerio");

// 하나은행 환율 조회 페이지가 내부적으로 호출하는 데이터 엔드포인트
const HANA_URL = "https://www.kebhana.com/cms/rate/wpfxd651_01i_01.do";
const HANA_REFERER = "https://www.kebhana.com/cms/rate/wpfxd651_01i.do";

const TODAY_TTL_MS = 60 * 1000; // 오늘 데이터는 1분 캐시 (고시 회차가 바뀔 수 있음)
const REQUEST_GAP_MS = 400; // 은행 서버에 부담 주지 않도록 요청 간격 확보

// ---------- 날짜 유틸 (한국 시간 기준) ----------
function kstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function isWeekend(iso) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 요청 직렬화 + 간격 제한 ----------
let chain = Promise.resolve();
function limited(fn) {
  const p = chain.then(fn);
  chain = p.catch(() => {}).then(() => sleep(REQUEST_GAP_MS));
  return p;
}

// ---------- HTML 파싱 ----------
function parseHanaHtml(html, requestedIso) {
  const $ = cheerio.load(html);

  let rows = $("div.printdiv tbody>tr");
  if (!rows.length) rows = $("tbody>tr");

  const rates = {};
  rows.each((_, tr) => {
    const cells = $(tr)
      .children()
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 10) return;

    const m = /\b([A-Z]{3})\b/.exec(cells[0]);
    if (!m) return;

    const num = (i) => {
      const v = parseFloat((cells[i] || "").replace(/,/g, ""));
      return Number.isFinite(v) ? v : null;
    };

    const cashBuy = num(1); // 현찰 사실 때
    const cashSell = num(3); // 현찰 파실 때
    if (!(cashBuy > 0 && cashSell > 0 && cashBuy > cashSell)) return;

    // 매매기준율은 칸 번호로 찍지 않고 "값"으로 찾는다.
    // 하나은행 환율은 현찰/송금 모두 매매기준율을 중심으로 위아래로 벌어지므로,
    // 현찰(사실때·파실때)의 중간값에 가장 가까운 칸이 매매기준율이다.
    // (표에 칼럼이 늘거나 줄어도 환가료율·미화환산율 같은 작은 숫자를 잘못 집지 않음)
    const wireSend = num(5);
    const wireReceive = num(6);
    const mids = [(cashBuy + cashSell) / 2];
    if (wireSend > 0 && wireReceive > 0) mids.push((wireSend + wireReceive) / 2);

    let basic = null;
    let best = Infinity;
    for (let i = 7; i < cells.length; i++) {
      const v = num(i);
      if (!(v > 0)) continue;
      for (const mid of mids) {
        const rel = Math.abs(v - mid) / mid;
        if (rel < best) {
          best = rel;
          basic = v;
        }
      }
    }
    if (basic === null || best > 0.005) return; // 중간값과 0.5% 이상 다르면 신뢰하지 않음

    const okWire = (v) => v > 0 && Math.abs(v - basic) / basic < 0.1;

    rates[m[1]] = {
      unit: /\(\s*100\s*\)/.test(cells[0]) ? 100 : 1, // 엔화 등은 100단위 고시
      basic,
      cashBuy,
      cashSell,
      wireSend: okWire(wireSend) ? wireSend : null, // 송금 보낼 때
      wireReceive: okWire(wireReceive) ? wireReceive : null, // 송금 받을 때
    };
  });

  if (!Object.keys(rates).length) {
    console.warn(
      "[hana] 환율 표를 찾지 못했습니다. 응답 앞부분:",
      html.slice(0, 300).replace(/\s+/g, " ")
    );
    return null;
  }

  // 헤더: [조회기준일?, 회차, 고시시각] 형태
  const heads = $("div.printdiv p>span>strong")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get();

  const roundMatch = heads[1] ? /\d+/.exec(heads[1]) : null;
  const timeMatch = heads.map((h) => /(\d{1,2}):(\d{2})/.exec(h)).find(Boolean);

  // 실제 고시일: 헤더에서 날짜를 찾되, 요청일 기준 최근 7일 이내일 때만 신뢰
  let date = requestedIso;
  for (const h of heads) {
    const dm = /(\d{4})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/.exec(h);
    if (!dm) continue;
    const iso = `${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}`;
    if (iso <= requestedIso && iso >= addDays(requestedIso, -7)) {
      date = iso;
      break;
    }
  }

  return {
    date,
    round: roundMatch ? Number(roundMatch[0]) : null,
    time: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null,
    rates,
  };
}

// ---------- 하루치 조회 (캐시 포함) ----------
const dayCache = new Map(); // iso -> { data, at, final }
const inflight = new Map();

async function fetchDay(iso) {
  const body = new URLSearchParams({
    ajax: "true",
    tmpInqStrDt: iso,
    tmpInpStrDt: iso,
    pbldDvCd: "0", // 0 = 해당일의 (현재) 최종 고시
    pbldSqn: "",
    inqStrDt: iso.replace(/-/g, ""),
    inqKindCd: "1",
    requestTarget: "searchContentDiv",
  });

  const res = await axios.post(HANA_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Referer: HANA_REFERER,
      "X-Requested-With": "XMLHttpRequest",
    },
    responseType: "arraybuffer",
    timeout: 10000,
    validateStatus: (s) => s < 500,
  });

  if (res.status >= 400) throw new Error(`하나은행 응답 오류 (status ${res.status})`);

  const html = Buffer.from(res.data).toString("utf8");
  return parseHanaHtml(html, iso);
}

async function getDay(iso, today) {
  const cached = dayCache.get(iso);
  if (cached && (cached.final || Date.now() - cached.at < TODAY_TTL_MS)) {
    return { data: cached.data, hit: true };
  }
  if (inflight.has(iso)) return inflight.get(iso);

  const p = limited(() => fetchDay(iso))
    .then((data) => {
      dayCache.set(iso, { data, at: Date.now(), final: iso < today });
      return { data, hit: false };
    })
    .finally(() => inflight.delete(iso));

  inflight.set(iso, p);
  return p;
}

const loggedSample = new Set(); // 통화별로 처음 한 번만 파싱 결과를 로그에 남김

// ---------- 공개 API ----------
// 통화 하나의 최신 환율 + 최근 영업일 이력
async function getHanaSnapshot(code, days = 10) {
  const t0 = Date.now();
  const today = kstToday();
  const points = new Map(); // 실제 고시일 -> 매매기준율
  let latest = null;
  let allCached = true;

  let cursor = today;
  const maxAttempts = days * 2 + 8;

  for (let i = 0; i < maxAttempts && points.size < days; i++) {
    if (isWeekend(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }

    let res;
    try {
      res = await getDay(cursor, today);
    } catch (e) {
      if (!latest) throw e; // 최신값조차 없으면 실패
      console.warn(`[hana] ${cursor} 이력 조회 실패, 가져온 데이터까지만 사용:`, e.message);
      break;
    }

    if (!res.hit) allCached = false;
    const rec = res.data?.rates?.[code];

    if (rec) {
      const actual = res.data.date || cursor;
      if (!points.has(actual)) points.set(actual, rec.basic);
      if (!latest) latest = { ...rec, date: actual, round: res.data.round, time: res.data.time };
    }
    cursor = addDays(cursor, -1);
  }

  if (!latest) throw new Error(`하나은행에서 ${code} 환율을 찾지 못했습니다.`);

  if (!loggedSample.has(code)) {
    loggedSample.add(code);
    console.log(
      `[hana] 파싱 확인 ${code}: 매매기준율 ${latest.basic} (현찰 ${latest.cashSell} ~ ${latest.cashBuy}) · ${latest.date} ${latest.round ?? "?"}회차`
    );
  }

  const history = [...points.entries()]
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    source: "hana",
    code,
    unit: latest.unit,
    basic: latest.basic,
    cashBuy: latest.cashBuy,
    cashSell: latest.cashSell,
    wireSend: latest.wireSend,
    wireReceive: latest.wireReceive,
    date: latest.date,
    round: latest.round,
    time: latest.time,
    history,
    fetchMs: Date.now() - t0,
    cacheHit: allCached,
  };
}

module.exports = { getHanaSnapshot, parseHanaHtml, kstToday, addDays };
