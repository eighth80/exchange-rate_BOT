require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
const { TEST_PREFIX } = require("./src/util/mode");

// ------------------------------------------------------------------
// 명령어 등록 규칙
//   배포용  : 전역(Global) 등록 -> 봇이 들어가 있는 모든 서버에서 /달러 등으로 사용
//   테스트용: TEST_GUILD_ID 서버에만 등록 -> /테스트-달러 처럼 이름 앞에 "테스트-"가 붙음
//   정리용  : 예전에 서버 전용으로 등록했던 명령어(GUILD_ID, CLEAR_GUILD_IDS)는 비움
//             (전역 명령어와 겹쳐서 같은 명령어가 두 개로 보이는 문제 방지)
// ------------------------------------------------------------------

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const testGuildId = (process.env.TEST_GUILD_ID || "").trim();
const dryRun = !!process.env.DRY_RUN;

const prodCommands = [];
const commandsPath = path.join(__dirname, "src", "commands");

for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  try {
    const command = require(path.join(commandsPath, file));
    if (!command.data) {
      console.warn(`⚠️ 명령어 데이터 없음: ${file}`);
      continue;
    }
    prodCommands.push(command.data.toJSON());
  } catch (error) {
    console.error(`❌ ${file} 로드 실패:`, error);
  }
}

const testCommands = prodCommands.map((json) => ({
  ...json,
  name: `${TEST_PREFIX}${json.name}`,
  description: `[테스트] ${json.description}`.slice(0, 100),
}));

const clearIds = [
  ...new Set(
    [process.env.GUILD_ID, ...(process.env.CLEAR_GUILD_IDS || "").split(",")]
      .map((s) => (s || "").trim())
      .filter(Boolean)
  ),
].filter((id) => id !== testGuildId);

(async () => {
  console.log(`📦 배포용 ${prodCommands.map((c) => "/" + c.name).join(" ")}`);
  if (testGuildId) {
    console.log(`🧪 테스트용(${testGuildId}) ${testCommands.map((c) => "/" + c.name).join(" ")}`);
  } else {
    console.log("ℹ️ TEST_GUILD_ID가 없어 테스트용 명령어는 등록하지 않습니다.");
  }
  if (clearIds.length) console.log(`🧹 서버 전용 명령어 정리 대상: ${clearIds.join(", ")}`);

  if (dryRun) {
    console.log("(DRY_RUN) 실제 등록은 하지 않았습니다.");
    return;
  }

  if (!token || !clientId) {
    console.error("❌ DISCORD_TOKEN 또는 CLIENT_ID가 없어 명령어 등록을 건너뜁니다.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    await rest.put(Routes.applicationCommands(clientId), { body: prodCommands });
    console.log("✅ 배포용(전역) 명령어 등록 완료");
  } catch (error) {
    console.error("❌ 배포용(전역) 명령어 등록 실패:", error.message || error);
  }

  if (testGuildId) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, testGuildId), {
        body: testCommands,
      });
      console.log("✅ 테스트 서버 명령어 등록 완료");
    } catch (error) {
      console.error("❌ 테스트 서버 명령어 등록 실패 (서버 ID와 봇 초대 상태 확인):", error.message || error);
    }
  }

  for (const id of clearIds) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, id), { body: [] });
      console.log(`🧹 ${id} 서버 전용 명령어 정리 완료`);
    } catch (error) {
      console.warn(`⚠️ ${id} 정리 건너뜀:`, error.message || error);
    }
  }
})();
