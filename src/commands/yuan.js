const { SlashCommandBuilder } = require("discord.js");
const { runFxCommand, addAmountOption } = require("../util/fxEmbed");

module.exports = {
  data: addAmountOption(
    new SlashCommandBuilder()
      .setName("위안")
      .setDescription("위안 → 한국 돈 (기본 1위안, 하나은행 기준)"),
    "위안"
  ),

  async execute(interaction, ctx) {
    await runFxCommand(interaction, "CNY", ctx);
  },
};
