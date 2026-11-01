const KO = "ko-KR";

// 입력 금액 표시: 1,234 / 1,234.5
function fmtAmount(n) {
  return n.toLocaleString(KO, { maximumFractionDigits: 2 });
}

// 환율(고시값) 표시: 항상 소수 2자리 + 천 단위 쉼표 -> 1,455.30
function fmtRate(n) {
  return n.toLocaleString(KO, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// 금액 크기에 따라 소수 자릿수 결정: 1,000원 이상은 원 단위, 그 미만은 소수 2자리
function pickDecimals(n) {
  return n >= 1000 ? 0 : 2;
}

// 원화 금액 표시 (소수 자릿수는 호출하는 쪽에서 한 번 정해서 모든 값에 똑같이 적용)
function fmtKRW(n, decimals = pickDecimals(n)) {
  return `${n.toLocaleString(KO, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}원`;
}

// 1만 이상일 때 읽기 쉬운 한글 단위: 1234567 -> "123만 4,567원"
function koreanUnitWon(n) {
  let v = Math.round(n);
  if (!Number.isFinite(v) || v < 10000) return null;

  const units = [
    ["조", 1e12],
    ["억", 1e8],
    ["만", 1e4],
  ];
  const parts = [];
  for (const [label, size] of units) {
    const q = Math.floor(v / size);
    if (q > 0) {
      parts.push(`${q.toLocaleString(KO)}${label}`);
      v -= q * size;
    }
  }
  if (v > 0) parts.push(v.toLocaleString(KO));
  return `${parts.join(" ")}원`;
}

// 전일 대비: ▲ 2.10원 (+0.23%)
function fmtChange(diff, pct) {
  if (!Number.isFinite(diff) || Math.abs(diff) < 0.005) return "보합";
  const arrow = diff > 0 ? "▲" : "▼";
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
  return `${arrow} ${fmtRate(Math.abs(diff))}원 (${sign}${Math.abs(pct).toFixed(2)}%)`;
}

module.exports = { fmtAmount, fmtRate, fmtKRW, pickDecimals, koreanUnitWon, fmtChange };
