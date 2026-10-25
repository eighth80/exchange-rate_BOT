const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../portfolio.json');

const defaultPortfolio = {
    'SCHD': { shares: 10, avgPrice: 83.0, targetPct: 10, dropPct: -5 },
    'SOXX': { shares: 1,  avgPrice: 220.0, targetPct: 15, dropPct: -7 },
    'KO':   { shares: 2,  avgPrice: 71.0, targetPct: 8,  dropPct: -3 }
};

function loadPortfolioData() {
    if (!fs.existsSync(dataPath)) {
        savePortfolioData(defaultPortfolio);
        return defaultPortfolio;
    }
    try {
        const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        return raw.portfolio || defaultPortfolio;
    } catch (e) {
        return defaultPortfolio;
    }
}

function savePortfolioData(portfolio) {
    let raw = {};
    if (fs.existsSync(dataPath)) {
        try { raw = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) {}
    }
    raw.portfolio = portfolio;
    fs.writeFileSync(dataPath, JSON.stringify(raw, null, 4), 'utf8');
}

async function handlePortfolioCommands(interaction) {
    const portfolio = loadPortfolioData();
    const commandName = interaction.commandName;
    const ticker = interaction.options.getString('티커', true).toUpperCase();

    if (commandName === '수량입력') {
        const shares = interaction.options.getNumber('수량', true);
        if (portfolio[ticker]) {
            portfolio[ticker].shares = shares;
            savePortfolioData(portfolio);
            await interaction.reply({ content: `✅ **${ticker}** 보유 수량 **${shares}주**로 수정되었습니다.`, ephemeral: true });
        } else {
            portfolio[ticker] = { shares, avgPrice: 0, targetPct: 10, dropPct: -5 };
            savePortfolioData(portfolio);
            await interaction.reply({ content: `🆕 **${ticker}** 신규 종목 등록 완료 (${shares}주). \`/평단입력\`으로 평단가도 설정하세요!`, ephemeral: true });
        }
    }

    if (commandName === '평단입력') {
        const avgPrice = interaction.options.getNumber('평단가', true);
        if (portfolio[ticker]) {
            portfolio[ticker].avgPrice = avgPrice;
            savePortfolioData(portfolio);
            await interaction.reply({ content: `✅ **${ticker}** 평단가 **$${avgPrice}** 로 영구 저장되었습니다.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `❌ 포트폴리오에 없는 종목입니다. \`/수량입력\`을 먼저 해주세요.`, ephemeral: true });
        }
    }

    if (commandName === '종목삭제') {
        if (portfolio[ticker]) {
            delete portfolio[ticker];
            savePortfolioData(portfolio);
            await interaction.reply({ content: `🗑️ **${ticker}** 종목이 포트폴리오에서 완전 삭제되었습니다.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `❌ 포트폴리오에 **${ticker}** 종목이 존재하지 않습니다.`, ephemeral: true });
        }
    }
}

module.exports = { loadPortfolioData, savePortfolioData, handlePortfolioCommands };