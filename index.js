require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "src", "commands");
const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of files) {
  const cmd = require(path.join(commandsPath, file));
  if (!cmd.data || !cmd.execute) continue;
  client.commands.set(cmd.data.name, cmd);
  console.log(`✅ 로드됨: /${cmd.data.name}`);
}

client.once("ready", () => {
  console.log(`🟢 로그인 완료: ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (e) {
    console.error(e);
    if (interaction.deferred) {
      await interaction.editReply("❌ 오류 발생");
    } else {
      await interaction.reply("❌ 오류 발생");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
