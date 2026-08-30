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
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("🟢 배포용(GLOBAL) 슬래시 커맨드 등록 완료");
})();
