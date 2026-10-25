const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { loadPortfolioData, savePortfolioData } = require('../commands/portfolio');
const { getStockQuote } = require('../services/stock');
const { getUsdKrwRate } = require('../services/exchange');
const { drawProfitBar } = require('../utils/chart');

const marketHolidays = ['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25'];
const earlyCloseDays = ['2026-07-02', '2026-11-27', '2026-12-24'];

function getNewYorkDateString() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function initSchedulers(client) {
    const CHANNEL_ID = process.env.CHANNEL_ID || '';

    // 1. 개장 알림
    cron.schedule('30 9 * * 1-5', () => {
        if (marketHolidays.includes(getNewYorkDateString())) return;
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel && channel.isTextBased()) channel.send('🔔 **미국 증시 정규장이 개장했습니다!**');
    }, { timezone: "America/New_York" });

    // 2. 급등락 감시 (15분 주기)
    cron.schedule('*/15 9-15 * * 1-5', async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel || !channel.isTextBased()) return;
        const portfolio = loadPortfolioData();

        for (const [ticker, data] of Object.entries(portfolio)) {
            if (!data.avgPrice || !data.shares) continue;
            const quote = await getStockQuote(ticker);
            if (!quote) continue;

            const currentPrice = quote.regularMarketPrice;
            const profitRate = ((currentPrice - data.avgPrice) / data.avgPrice) * 100;

            if (profitRate >= data.targetPct) {
                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle(`🚀 [수익 달성] ${ticker} 급등!`)
                    .setDescription(`목표 수익률(**${data.targetPct}%**)을 돌파했습니다!`)
                    .addFields(
                        { name: '내 평단가', value: `$${data.avgPrice.toFixed(2)}`, inline: true },
                        { name: '현재가', value: `$${currentPrice.toFixed(2)}`, inline: true },
                        { name: '수익률', value: `**+${profitRate.toFixed(2)}%**\n${drawProfitBar(profitRate)}`, inline: false }
                    );
                channel.send({ content: `@everyone 🚀 **${ticker}** 목표 수익률 도달!`, embeds: [embed] });
                data.targetPct += 5;
                savePortfolioData(portfolio);
            }
        }
    }, { timezone: "America/New_York" });

    // 3. 배당지급일(Pay Date) 당일 멘션 알림 (매일 09:05 KST)
    cron.schedule('5 9 * * *', async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel || !channel.isTextBased()) return;

        const portfolio = loadPortfolioData();
        const todayStr = new Date().toISOString().split('T')[0];
        let hasAlert = false;
        let totalUsd = 0;

        const rate = await getUsdKrwRate();
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🥳 오늘은 배당금 지급일(Pay Date)입니다!')
            .setDescription('미국 현지에서 배당금이 지급됩니다.\n(국내 계좌에는 **1~3영업일 내** 입금됩니다.)');

        for (const [ticker, data] of Object.entries(portfolio)) {
            if (!data.shares) continue;
            const quote = await getStockQuote(ticker);
            if (quote && quote.dividendDate && new Date(quote.dividendDate).toISOString().split('T')[0] === todayStr) {
                hasAlert = true;
                const annualDiv = quote.trailingAnnualDividendRate || 0;
                const estDiv = ticker === 'O' ? (annualDiv / 12) : (annualDiv / 4);
                const afterTax = (estDiv * data.shares) * 0.846;
                totalUsd += afterTax;

                embed.addFields({
                    name: `💰 ${ticker} (${data.shares}주)`,
                    value: `\`세후 실수령:\` **$${afterTax.toFixed(2)}** (약 **₩${Math.round(afterTax * rate).toLocaleString('ko-KR')}원**)`,
                    inline: false
                });
            }
        }

        if (hasAlert) {
            embed.setFooter({ text: `총 입금 예정액: $${totalUsd.toFixed(2)} (약 ₩${Math.round(totalUsd * rate).toLocaleString('ko-KR')}원)` });
            channel.send({ content: `🔔 @everyone **오늘 배당금이 들어오는 날입니다!** 계좌를 확인해 보세요.`, embeds: [embed] });
        }
    }, { timezone: "Asia/Seoul" });
}

module.exports = { initSchedulers };