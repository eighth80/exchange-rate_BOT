const { SlashCommandBuilder } = require("discord.js");
const { runFxCommand, addAmountOption } = require("../util/fxEmbed");

module.exports = {
  data: addAmountOption(
    new SlashCommandBuilder()
      .setName("엔화")
      .setDescription("엔화 → 한국 돈 (기본 100엔, 하나은행 기준)"),
    "엔"
  ),

  async execute(interaction, ctx) {
    await runFxCommand(interaction, "JPY", ctx);
  },
};
