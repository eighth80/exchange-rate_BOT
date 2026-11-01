const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const BUG_REPORT_DISCORD = "https://discord.gg/K8gA626GCT";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("버그제보")
    .setDescription("버그를 발견했다면 제보 서버로 알려줘"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("🐛 버그 제보")
      .setColor(0xed4245)
      .setDescription(
        "봇 사용 중 이상한 점이나 오류를 발견하셨나요?\n아래 버튼을 눌러 제보 서버로 이동해주세요!"
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("버그 제보 서버로 이동")
        .setStyle(ButtonStyle.Link)
        .setURL(BUG_REPORT_DISCORD)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
