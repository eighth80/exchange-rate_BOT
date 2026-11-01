function formatKoreanTimeKST(date = new Date()) {
  // Asia/Seoul 기준으로 변환
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));

  // ko-KR에서는 dayPeriod가 "오전"/"오후"로 나옴
  // month/day는 보통 "12." 처럼 점이 붙기도 해서, 여기선 숫자만 남김
  const year = map.year;
  const month = String(map.month).replace(/\D/g, "");
  const day = String(map.day).replace(/\D/g, "");
  const dayPeriod = map.dayPeriod; // 오전/오후
  const hour = String(map.hour).replace(/\D/g, "");
  const minute = String(map.minute).replace(/\D/g, "");
  const second = String(map.second).replace(/\D/g, "");

  return `${year}. ${Number(month)}. ${Number(day)}. ${dayPeriod} ${hour}:${minute}:${second}`;
}

module.exports = { formatKoreanTimeKST };
