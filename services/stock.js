const yahooFinanceRaw = require('yahoo-finance2');
const yahooFinance = yahooFinanceRaw.default || yahooFinanceRaw;

// 요청 지연시간(딜레이) 함수
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getStockQuote(ticker) {
    try {
        // Too Many Requests 방지를 위해 요청 시 약간의 지연시간 추가
        await sleep(200);
        const quote = await yahooFinance.quote(ticker);
        if (!quote || !quote.regularMarketPrice) {
            throw new Error('시세 데이터 누락');
        }
        return quote;
    } catch (error) {
        console.error(`❌ [${ticker}] 시세 수집 오류:`, error.message);
        return null; // 실패 시 null 반환으로 안전 처리
    }
}

module.exports = { getStockQuote };