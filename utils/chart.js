const axios = require("axios");

// 한국 증시 관례: 상승 = 빨강, 하락 = 파랑
const COLORS = {
  up: "#ff6b6b",
  down: "#5b9bff",
  flat: "#9aa4b2",
};

const BG = "#2b2d31"; // 디스코드 다크 모드 임베드 배경과 같은 색 -> 카드가 자연스럽게 이어짐
const GRID = "rgba(255,255,255,0.07)";
const TICK = "#8b93a1";

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function trendColor(values) {
  const diff = values[values.length - 1] - values[0];
  if (Math.abs(diff) < 1e-9) return COLORS.flat;
  return diff > 0 ? COLORS.up : COLORS.down;
}

// 이미지 안에는 한글을 넣지 않음 (렌더 서버 폰트 문제 방지). 제목/설명은 임베드가 담당.
function buildConfig({ labels, values, title }) {
  const n = values.length;
  const last = n - 1;

  let minI = 0;
  let maxI = 0;
  values.forEach((v, i) => {
    if (v < values[minI]) minI = i;
    if (v > values[maxI]) maxI = i;
  });
  const lo = values[minI];
  const hi = values[maxI];
  const span = hi - lo || Math.max(hi * 0.002, 0.01);
  const yMin = lo - span * 0.4;
  const yMax = hi + span * 0.5;

  const accent = trendColor(values);
  const radii = values.map((_, i) => (i === last ? 7 : 0));
  const show = JSON.stringify([...new Set([minI, maxI, last])]);
  const minOnly = minI !== last && minI !== maxI ? minI : -1;

  // 함수(콜백)를 쓰기 위해 JSON이 아닌 JS 문자열로 전달
  return `{
  type: 'line',
  data: {
    labels: ${JSON.stringify(labels)},
    datasets: [{
      data: ${JSON.stringify(values)},
      borderColor: '${accent}',
      borderWidth: 4,
      stepped: 'middle',
      fill: true,
      backgroundColor: getGradientFillHelper('vertical', ['${hexToRgba(accent, 0.38)}', '${hexToRgba(accent, 0.0)}']),
      pointRadius: ${JSON.stringify(radii)},
      pointHoverRadius: 0,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '${accent}',
      pointBorderWidth: 3
    }]
  },
  options: {
    animation: false,
    layout: { padding: { top: 8, right: 36, left: 8, bottom: 4 } },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: ${JSON.stringify(title)},
        align: 'start',
        color: '#e6e9ef',
        font: { size: 22, weight: 'bold' },
        padding: { bottom: 18 }
      },
      datalabels: {
        display: function(c) { return ${show}.indexOf(c.dataIndex) !== -1; },
        anchor: 'center',
        align: function(c) { return c.dataIndex === ${minOnly} ? 'bottom' : 'top'; },
        offset: 12,
        color: function(c) { return c.dataIndex === ${last} ? '#ffffff' : '${TICK}'; },
        font: function(c) { return { size: c.dataIndex === ${last} ? 22 : 15, weight: c.dataIndex === ${last} ? 'bold' : 'normal' }; },
        formatter: function(v) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '${TICK}', font: { size: 15 }, autoSkip: false, maxRotation: 0 }
      },
      y: {
        min: ${yMin},
        max: ${yMax},
        grid: { color: '${GRID}' },
        border: { display: false },
        ticks: {
          color: '${TICK}',
          font: { size: 15 },
          maxTicksLimit: 4,
          callback: function(v) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
        }
      }
    }
  }
}`;
}

// 'YYYY-MM-DD' -> 'MM.DD'
function shortDate(iso) {
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
}

async function buildFxChartPng({ history, title }) {
  const labels = history.map((h) => shortDate(h.date));
  const values = history.map((h) => Math.round(h.rate * 100) / 100);

  const res = await axios.post(
    "https://quickchart.io/chart",
    {
      chart: buildConfig({ labels, values, title }),
      version: "4",
      width: 900,
      height: 420,
      devicePixelRatio: 2,
      backgroundColor: BG,
      format: "png",
    },
    { responseType: "arraybuffer", timeout: 20000, validateStatus: (s) => s < 500 }
  );

  if (res.status >= 400) throw new Error(`그래프 생성 실패 (status ${res.status})`);
  return Buffer.from(res.data);
}

module.exports = { buildFxChartPng, buildConfig, trendColor, COLORS };
