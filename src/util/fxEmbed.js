const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { getFxSnapshot } = require("../fx");
const { buildFxChartPng, trendColor } = require("./chart");
const { formatKoreanTimeKST } = require("./timeKST");
const {
  fmtAmount,
  fmtRate,
  fmtKRW,
  pickDecimals,
  koreanUnitWon,
  fmtChange,
} = require("./format");

const CURRENCY = {
  USD: { emoji: "🇺🇸", label: "달러", word: "달러", defaultAmount: 1, pair: "USD / KRW" },
  JPY: { emoji: "🇯🇵", label: "엔화", word: "엔", defaultAmount: 100, pair: "JPY(100) / KRW" },
  CNY: { emoji: "🇨🇳", label: "위안", word: "위안", defaultAmount: 1, pair: "CNY / KRW" },
};

const UP = 0xe5484d; // 상승 = 빨강
const DOWN = 0x3e63dd; // 하락 = 파랑
const FLAT = 0x8e8e93;

// 모든 환율 명령어에 공통으로 붙는 "금액" 옵션
function addAmountOption(builder, word) {
  return builder.addNumberOption((opt) =>
    opt
      .setName("금액")
      .setDescription(`환산할 ${word} 금액 (비우면 기본 기준 금액)`)
      .setMinValue(0.01)
      .setMaxValue(1e12)
  );
}

async function runFxCommand(interaction, code, ctx = {}) {
  const test = !!ctx.test;
  const meta = CURRENCY[code];

  await interaction.deferReply();

  try {
    const snap = await getFxSnapshot(code, 10);

    const customAmount = interaction.options.getNumber("금액");
    const amount = customAmount ?? meta.defaultAmount;
    const isDefault = customAmount === null || customAmount === undefined;

    const perUnit = (rate) => (amount * rate) / snap.unit; // 입력 금액을 원화로
    const unitLabel = `${fmtAmount(snap.unit)}${meta.word}`;

    const converted = perUnit(snap.basic);
    // 기본 기준(100엔 등)은 환율 그대로 소수 2자리, 직접 입력한 금액은 크기에 맞춰 깔끔하게
    const decimals = isDefault ? 2 : pickDecimals(converted);
    const won = fmtKRW(converted, decimals);
    const korean = isDefault ? null : koreanUnitWon(converted);

    // ----- 설명(큰 글씨 결과) -----
    const lines = [`## ${fmtAmount(amount)}${meta.word} = ${won}`];
    if (korean) lines.push(`**≈ ${korean}**`);
    if (!isDefault) {
      lines.push(`적용 환율(매매기준율) ${unitLabel} = ${fmtRate(snap.basic)}원`);
    }
    if (snap.change) {
      lines.push(`${unitLabel} 기준 전일 대비 ${fmtChange(snap.change.diff, snap.change.pct)}`);
    }

    // ----- 색상 -----
    const color = !snap.change || Math.abs(snap.change.diff) < 0.005
      ? FLAT
      : snap.change.diff > 0 ? UP : DOWN;

    const embed = new EmbedBuilder()
      .setTitle(`${test ? "🧪 [테스트] " : ""}${meta.emoji} ${meta.label} 환율`)
      .setColor(color)
      .setDescription(lines.join("\n"));

    // ----- 하나은행 현찰/송금 환율 (대체 소스일 땐 없음) -----
    if (snap.cashBuy && snap.cashSell) {
      const f = (rate) => fmtKRW(perUnit(rate), decimals);
      embed.addFields(
        { name: "현찰 살 때", value: f(snap.cashBuy), inline: true },
        { name: "현찰 팔 때", value: f(snap.cashSell), inline: true }
      );
      if (snap.wireSend) {
        embed.addFields({ name: "송금 보낼 때", value: f(snap.wireSend), inline: true });
      }
    }

    // ----- 그래프 (실패해도 숫자는 보여주기) -----
    const files = [];
    let chartNote = "";
    if (snap.history.length >= 2) {
      try {
        const png = await buildFxChartPng({
          history: snap.history,
          title: meta.pair,
        });
        files.push(new AttachmentBuilder(png, { name: "chart.png" }));
        embed.setImage("attachment://chart.png");
      } catch (e) {
        console.error("[chart] 그래프 생성 실패:", e.message);
        chartNote = " · 그래프 생성 실패";
      }
    }

    // ----- 푸터 -----
    const nowText = formatKoreanTimeKST();
    let footer;
    if (snap.source === "hana") {
      const round = snap.round ? `${snap.round}회차` : "";
      const time = snap.time ? `${snap.time} 고시` : "";
      const meta2 = [round, time].filter(Boolean).join(" ");
      footer = `하나은행${meta2 ? ` · ${meta2}` : ""} · ${nowText}`;
    } else {
      footer = `⚠️ 하나은행 조회 실패 → ECB 참고 환율 · ${nowText}`;
    }
    footer += chartNote;
    if (test) {
      footer += ` | 🧪 ${snap.fetchMs}ms · ${snap.cacheHit ? "캐시" : "신규 조회"} · ${snap.source}`;
      if (snap.hanaError) footer += ` · ${snap.hanaError}`;
    }
    embed.setFooter({ text: footer.slice(0, 2000) });

    await interaction.editReply({ embeds: [embed], files });
  } catch (e) {
    console.error(`[${code}] 명령어 처리 실패:`, e);
    await interaction.editReply(`❌ 실패: ${e.message}`);
  }
}

module.exports = { runFxCommand, addAmountOption, CURRENCY };
