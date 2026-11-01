const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const axios = require("axios");
const { formatKoreanTimeKST } = require("../util/timeKST");

const BUG_REPORT_DISCORD = "https://discord.gg/K8gA626GCT";

function pngUrl(q) {
  return `https://wttr.in/${encodeURIComponent(q)}.png?lang=ko&m`;
}
function jsonUrl(q) {
  return `https://wttr.in/${encodeURIComponent(q)}?format=j1&lang=ko&m`;
}

async function fetchPng(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return Buffer.from(res.data);
}

async function fetchJson(url) {
  const res = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return res.data;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("날씨")
    .setDescription("나라/도시 날씨 (표 이미지 + 수치 텍스트)")
    .addStringOption(opt =>
      opt.setName("나라")
        .setDescription("예: 일본, 미국, 중국, 서울, 도쿄")
        .setRequired(true)
    ),

  async execute(interaction, ctx = {}) {
    await interaction.deferReply();
    const nowText = formatKoreanTimeKST();
    const query = interaction.options.getString("나라", true);

    try {
      // 병렬 처리
      const [pngBuffer, data] = await Promise.all([
        fetchPng(pngUrl(query)),
        fetchJson(jsonUrl(query)),
      ]);

      const file = new AttachmentBuilder(pngBuffer, { name: "weather.png" });

      const cur = data.current_condition?.[0];
      if (!cur) throw new Error("날씨 데이터를 가져오지 못했어");

      const desc = cur.weatherDesc?.[0]?.value ?? "정보 없음";

      const textBlock =
`**현재 상태:** ${desc}
**기온:** ${cur.temp_C}°C (체감 ${cur.FeelsLikeC}°C)
**습도:** ${cur.humidity}%
**바람:** ${cur.windspeedKmph} km/h
**강수량:** ${cur.precipMM} mm
**가시거리:** ${cur.visibility} km`;

      const embed = new EmbedBuilder()
        .setTitle(`${ctx.test ? "🧪 [테스트] " : ""}🌤️ ${query} 날씨`)
        .setColor(0x4aa3ff)
        .setImage("attachment://weather.png")
        .setDescription(textBlock)
        .setFooter({
          text: `출처: wttr.in | 현재 시간: ${nowText}`,
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(" 버그 제보는 디스코드로!")
          .setStyle(ButtonStyle.Link)
          .setURL(BUG_REPORT_DISCORD)
      );

      await interaction.editReply({
        embeds: [embed],
        files: [file],
        components: [row],
      });
    } catch (e) {
      const msg =
        String(e.message).includes("timeout")
          ? "❌ 실패: wttr.in 응답 지연 (잠시 후 다시 시도해줘)"
          : `❌ 실패: ${e.message}`;
      await interaction.editReply(msg);
    }
  },
};
