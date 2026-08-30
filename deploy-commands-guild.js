require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

const commands = [];
const files = fs.readdirSync(path.join(__dirname, "src", "commands"));

for (const file of files) {
  const cmd = require(`./src/commands/${file}`);
  if (cmd.data) commands.push(cmd.data.toJSON());
}

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );
  console.log("🟢 개발용(GUILD) 슬래시 커맨드 등록 완료");
})();
