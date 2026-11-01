require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { TEST_PREFIX } = require("./src/util/mode");
const { warmUp } = require("./src/fx");

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN이 설정되지 않았습니다. .env 파일과 compose의 env_file 설정을 확인하세요.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 이름 -> { cmd, test }
//   배포용:  /달러
//   테스트용: /테스트-달러  (TEST_GUILD_ID 서버에만 등록됨, 같은 코드지만 테스트 표시 + 진단 정보 포함)
client.commands = new Collection();

const commandsPath = path.join(__dirname, "src", "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const cmd = require(path.join(commandsPath, file));
  if (!cmd.data || !cmd.execute) continue;

  client.commands.set(cmd.data.name, { cmd, test: false });
  client.commands.set(`${TEST_PREFIX}${cmd.data.name}`, { cmd, test: true });
  console.log(`✅ 로드됨: /${cmd.data.name} (+ /${TEST_PREFIX}${cmd.data.name})`);
}

client.once("ready", () => {
  console.log(`로그인 완료: ${client.user.tag}`);
  warmUp(); // 기다리지 않고 백그라운드로 환율 캐시 준비
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const entry = client.commands.get(interaction.commandName);
  if (!entry) return;

  console.log(
    `[cmd] /${interaction.commandName} · ${interaction.user.tag} · ${interaction.guild?.name ?? "DM"}`
  );

  try {
    await entry.cmd.execute(interaction, { test: entry.test });
  } catch (e) {
    console.error(e);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ 오류 발생");
      } else {
        await interaction.reply("❌ 오류 발생");
      }
    } catch (e2) {
      console.error("오류 응답 전송 실패:", e2.message);
    }
  }
});

client.on("error", (e) => console.error("[client error]", e));
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));

client.login(process.env.DISCORD_TOKEN);
