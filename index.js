require('dotenv').config();
const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const { handlePortfolioCommands } = require('./commands/portfolio');
const { handleAssetCommand } = require('./commands/asset');
const { handleTestAlertCommand } = require('./commands/testAlert');
const { initSchedulers } = require('./schedulers/notifier');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`✅ [Src 모듈 구조] 디스코드 배당 봇 가동 완료: ${client.user?.tag}`);

    // 슬래시 명령어 세팅
    if (client.application) {
        await client.application.commands.set([
            {
                name: '수량입력', description: '종목의 보유 수량을 수정하거나 추가합니다.',
                options: [
                    { name: '티커', type: ApplicationCommandOptionType.String, description: '예: SCHD', required: true },
                    { name: '수량', type: ApplicationCommandOptionType.Number, description: '예: 12.5', required: true }
                ]
            },
            {
                name: '평단입력', description: '보유 종목의 평균단가를 입력합니다.',
                options: [
                    { name: '티커', type: ApplicationCommandOptionType.String, description: '예: SCHD', required: true },
                    { name: '평단가', type: ApplicationCommandOptionType.Number, description: '예: 83.5', required: true }
                ]
            },
            {
                name: '종목삭제', description: '전량 매도 시 포트폴리오에서 완전히 삭제합니다.',
                options: [{ name: '티커', type: ApplicationCommandOptionType.String, description: '예: SCHD', required: true }]
            },
            { name: '내자산', description: '현재 수익률, 원화 평가금액, 배당금 차트를 보여줍니다.' },
            {
                name: '테스트알림', description: '[테스트모드] 다양한 알림 및 멘션을 즉시 검증합니다.',
                options: [
                    {
                        name: '유형',
                        type: ApplicationCommandOptionType.String,
                        description: '테스트 종류 선택',
                        required: true,
                        choices: [
                            { name: '💰 배당금 지급일 알림 (멘션 포함)', value: 'paydate' },
                            { name: '🚀 급등 알림', value: 'surge' },
                            { name: '🚨 하락 경고 알림', value: 'drop' }
                        ]
                    }
                ]
            }
        ]);
    }

    // 크론 스케줄러 가동
    initSchedulers(client);
});

// 디스코드 명령어 라우팅
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (['수량입력', '평단입력', '종목삭제'].includes(commandName)) {
        await handlePortfolioCommands(interaction);
    } else if (commandName === '내자산') {
        await handleAssetCommand(interaction);
    } else if (commandName === '테스트알림') {
        await handleTestAlertCommand(interaction);
    }
});

client.login(process.env.DISCORD_TOKEN);