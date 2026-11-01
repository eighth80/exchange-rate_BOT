const { getHanaSnapshot } = require("./hanaFx");
const { getFallbackSnapshot } = require("./fallbackFx");

// 하나은행 환율을 우선 사용하고, 실패하면 대체 소스로 (화면에 대체임을 표시)
async function getFxSnapshot(code, days = 10) {
  let snap;
  let hanaError = null;

  try {
    snap = await getHanaSnapshot(code, days);
  } catch (e) {
    hanaError = e;
    console.error(`[fx] 하나은행 조회 실패 (${code}) -> 대체 소스 사용:`, e.message);
    try {
      snap = await getFallbackSnapshot(code, days);
    } catch (e2) {
      console.error("[fx] 대체 소스도 실패:", e2.message);
      throw new Error("환율 조회에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  // 전일 대비 (최신 고시일보다 이전 날짜 중 가장 최근 값)
  const prev = [...snap.history].reverse().find((h) => h.date < snap.date);
  if (prev && prev.rate > 0) {
    const diff = snap.basic - prev.rate;
    snap.change = { diff, pct: (diff / prev.rate) * 100, prevDate: prev.date };
  } else {
    snap.change = null;
  }

  // 그래프의 마지막 점은 항상 현재 값과 일치시킴
  if (snap.history.length) {
    const last = snap.history[snap.history.length - 1];
    if (last.date === snap.date) last.rate = snap.basic;
    else snap.history.push({ date: snap.date, rate: snap.basic });
  }

  snap.hanaError = hanaError ? hanaError.message : null;
  return snap;
}

// 봇 시작 시 미리 데이터를 받아 두어 첫 명령어 응답을 빠르게
async function warmUp() {
  try {
    await getFxSnapshot("USD", 10); // 한 번 조회하면 모든 통화가 캐시됨
    console.log("🔥 환율 캐시 준비 완료");
  } catch (e) {
    console.warn("환율 캐시 준비 실패(무시):", e.message);
  }
}

module.exports = { getFxSnapshot, warmUp };
