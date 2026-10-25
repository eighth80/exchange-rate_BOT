const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../portfolio.json');

function getLastRate() {
    if (fs.existsSync(dataPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            if (data._lastUsdRate) return data._lastUsdRate;
        } catch (e) {}
    }
    return 1350.0;
}

function saveLastRate(rate) {
    let data = {};
    if (fs.existsSync(dataPath)) {
        try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) {}
    }
    data._lastUsdRate = rate;
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 4), 'utf8');
}

async function getUsdKrwRate() {
    try {
        const response = await axios.post(
            'https://www.hanabank.com/cms/rate/wpGetExchangeRateList.do',
            'ajax=true&curCd=USD&rateType=1',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                timeout: 5000
            }
        );

        const $ = cheerio.load(response.data);
        let rateText = '';

        $('table tbody tr').each((i, el) => {
            const text = $(el).text();
            if (text.includes('USD')) {
                const tdText = $(el).find('td').eq(1).text().trim();
                if (tdText) rateText = tdText;
            }
        });

        const cleanText = rateText.replace(/[^0-9.]/g, '');
        const rate = parseFloat(cleanText);

        if (!rate || isNaN(rate)) throw new Error("파싱 실패");

        saveLastRate(rate);
        return rate;
    } catch (error) {
        const backupRate = getLastRate();
        console.error(`❌ 하나은행 환율 크롤링 실패, 백업 환율(₩${backupRate})을 사용합니다:`, error.message);
        return backupRate;
    }
}

module.exports = { getUsdKrwRate };