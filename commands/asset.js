const { EmbedBuilder } = require('discord.js');
const { loadPortfolioData } = require('./portfolio');
const { getUsdKrwRate } = require('../services/exchange');
const { getStockQuote } = require('../services/stock');
const { drawBarChart, drawProfitBar } = require('../utils/chart');

async function handleAssetCommand(interaction) {
    await interaction.deferReply();

    const portfolio = loadPortfolioData();
    let totalInvested = 0, totalCurrentValue = 0, totalDividend = 0;
    const fields = [];
    const assetDetails = [];

    try {
        const currentExchangeRate = await getUsdKrwRate();

        for (const [ticker, data] of Object.entries(portfolio)) {
            if (!data.shares || data.shares === 0) continue;

            const quote = await getStockQuote(ticker);
            if (quote) {
                const currentPrice = quote.regularMarketPrice;
                const divPerShare = quote.trailingAnnualDividendRate || 0;
                
                const investedValue = (data.avgPrice || 0) * data.shares;
                const currentValue = currentPrice * data.shares;
                const profitRate = data.avgPrice > 0 ? ((currentPrice - data.avgPrice) / data.avgPrice) * 100 : 0;

                totalInvested += investedValue;
                totalCurrentValue += currentValue;
                totalDividend += (divPerShare * data.shares);

                assetDetails.push({ ticker, shares: data.shares, avgPrice: data.avgPrice, currentPrice, currentValue, profitRate, annualDiv: divPerShare * data.shares, isError: false });
            } else {
                const investedValue = (data.avgPrice || 0) * data.shares;
                totalInvested += investedValue;
                totalCurrentValue += investedValue;
                assetDetails.push({ ticker, shares: data.shares, avgPrice: data.avgPrice, currentValue: investedValue, isError: true });
            }
        }

        let allocationChartText = '```text\n[포트폴리오 자산 비중 차트]\n';
        if (assetDetails.length === 0) {
            allocationChartText += '등록된 보유 종목이 없습니다.\n';
        } else {
            for (const item of assetDetails) {
                const weightPct = totalCurrentValue > 0 ? (item.currentValue / totalCurrentValue) * 100 : 0;
                if (item.isError) {
                    allocationChartText += `${item.ticker.padEnd(5, ' ')} │ ⬜⬜⬜⬜⬜⬜⬜⬜ ⚠️ [시세점검]\n`;
                    fields.push({ name: `${item.ticker} (${item.shares}주)`, value: `⚠️ \`시세 점검중\`\n\`평단:\` $${item.avgPrice.toFixed(2)}`, inline: true });
                } else {
                    const symbol = item.profitRate >= 0 ? '🔺' : '🔻';
                    allocationChartText += `${item.ticker.padEnd(5, ' ')} │ ${drawBarChart(weightPct)} ${weightPct.toFixed(1)}%\n`;
                    fields.push({
                        name: `${item.ticker} (${item.shares}주 / ${weightPct.toFixed(1)}%)`,
                        value: `\`평단가:\` $${item.avgPrice.toFixed(2)}\n\`현재가:\` $${item.currentPrice.toFixed(2)}\n\`수익률:\` ${symbol} **${item.profitRate.toFixed(2)}%**\n${drawProfitBar(item.profitRate, 5)}\n\`배당금:\` $${item.annualDiv.toFixed(2)}/연`,
                        inline: true
                    });
                }
            }
        }
        allocationChartText += '```';

        const totalProfitRate = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;
        const mainSymbol = totalProfitRate >= 0 ? '🔴' : '🔵';
        const totalKrw = totalCurrentValue * currentExchangeRate;

        const embed = new EmbedBuilder()
            .setColor(totalProfitRate >= 0 ? '#ff4757' : '#2ed573')
            .setTitle('💼 내 포트폴리오 종합 상황판')
            .setDescription(
                `💵 하나은행 환율: **$1 = ₩${currentExchangeRate.toLocaleString('ko-KR')}**\n\n` +
                `현재 총 평가금액: **$${totalCurrentValue.toFixed(2)}** (약 **₩${Math.round(totalKrw).toLocaleString('ko-KR')}원**)\n` +
                `총 투자원금: $${totalInvested.toFixed(2)}\n` +
                `총 수익률: ${mainSymbol} **${totalProfitRate.toFixed(2)}%**\n` +
                `연간 예상 배당금: 💸 **$${totalDividend.toFixed(2)}**\n\n` +
                allocationChartText
            )
            .addFields(fields)
            .setFooter({ text: 'Yahoo Finance & 하나은행 매매기준율' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('내자산 명령 처리 실패:', error);
        await interaction.editReply('❌ 자산 데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

module.exports = { handleAssetCommand };