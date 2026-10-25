const { EmbedBuilder } = require('discord.js');
const { loadPortfolioData } = require('./portfolio');
const { getUsdKrwRate } = require('../services/exchange');
const { drawProfitBar } = require('../utils/chart');

async function handleTestAlertCommand(interaction) {
    const testType = interaction.options.getString('유형', true);
    await interaction.deferReply({ ephemeral: true });

    const portfolio = loadPortfolioData();
    const rate = await getUsdKrwRate();
    const channel = interaction.channel;

    if (!channel || !channel.isTextBased()) {
        return interaction.editReply('❌ 채널 정보를 찾을 수 없습니다.');
    }

    if (testType === 'paydate') {
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🧪 [테스트모드] 오늘은 배당금 지급일(Pay Date)입니다!')
            .setDescription('미국 현지 배당이 지급됩니다.\n(※ 국내 증권사 계좌에는 **1~3영업일 내**로 입금 처리됩니다.)');

        let totalUsd = 0;
        for (const [ticker, data] of Object.entries(portfolio)) {
            if (data.shares === 0) continue;
            const mockDiv = ticker === 'SCHD' ? 0.75 : (ticker === 'KO' ? 0.48 : 2.10);
            const beforeTax = mockDiv * data.shares;
            const afterTax = beforeTax * 0.846;
            const afterTaxKrw = afterTax * rate;
            totalUsd += afterTax;

            embed.addFields({
                name: `💰 ${ticker} (${data.shares}주 보유)`,
                value: `\`1주당 배당:\` $${mockDiv.toFixed(2)}\n\`세후 실수령:\` **$${afterTax.toFixed(2)}** (약 **₩${Math.round(afterTaxKrw).toLocaleString('ko-KR')}원**)`,
                inline: false
            });
        }

        const totalKrw = totalUsd * rate;
        embed.setFooter({ text: `[테스트] 적용 환율: ₩${rate} | 총 입금 예정액: $${totalUsd.toFixed(2)} (약 ₩${Math.round(totalKrw).toLocaleString('ko-KR')}원)` });

        await channel.send({ content: `🔔 @everyone **[테스트 알림] 오늘 배당금이 들어오는 날입니다!** 계좌를 확인해 보세요.`, embeds: [embed] });
        await interaction.editReply('✅ 배당금 지급일 테스트 알림 및 멘션 발송을 완료했습니다.');
    }

    if (testType === 'surge') {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🧪 [테스트모드] 🚀 SCHD 급등 알림!')
            .setDescription('설정하신 목표 수익률(**+10%**)을 돌파했습니다!')
            .addFields(
                { name: '내 평단가', value: '$83.00', inline: true },
                { name: '현재가', value: '$91.50', inline: true },
                { name: '수익률', value: '**+10.24%**\n' + drawProfitBar(10.24), inline: false }
            );

        await channel.send({ content: `@everyone 🚀 **[테스트] SCHD** 종목이 목표 수익률에 도달했습니다!`, embeds: [embed] });
        await interaction.editReply('✅ 급등 테스트 알림 발송 완료!');
    }

    if (testType === 'drop') {
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🧪 [테스트모드] 🚨 SOXX 하락 경고!')
            .setDescription('설정하신 하락선(**-5%**)을 이탈했습니다.')
            .addFields(
                { name: '내 평단가', value: '$220.00', inline: true },
                { name: '현재가', value: '$208.50', inline: true },
                { name: '수익률', value: '**-5.22%**\n' + drawProfitBar(-5.22), inline: false }
            );

        await channel.send({ content: `@everyone 🚨 **[테스트] SOXX** 하락 경고! 추가 매수 타이밍을 체크하세요.`, embeds: [embed] });
        await interaction.editReply('✅ 하락 테스트 알림 발송 완료!');
    }
}

module.exports = { handleTestAlertCommand };