const { SlashCommandBuilder } = require("discord.js");
const { runFxCommand, addAmountOption } = require("../util/fxEmbed");

module.exports = {
  data: addAmountOption(
    new SlashCommandBuilder()
      .setName("달러")
      .setDescription("달러 → 한국 돈 (기본 1달러, 하나은행 기준)"),
    "달러"
  ),

  async execute(interaction, ctx) {
    await runFxCommand(interaction, "USD", ctx);
  },
};
