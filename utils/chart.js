// 비율 막대 차트 (비중 표시용)
function drawBarChart(percent, length = 8) {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * length);
    const empty = length - filled;
    return '🟩'.repeat(filled) + '⬜'.repeat(empty);
}

// 수익률 막대 차트
function drawProfitBar(profitRate, length = 6) {
    const isPositive = profitRate >= 0;
    const absVal = Math.min(Math.abs(profitRate), 50);
    const filled = Math.max(1, Math.round((absVal / 50) * length));
    const empty = length - filled;
    const block = isPositive ? '🟥' : '🟦';
    return block.repeat(filled) + '⬜'.repeat(empty);
}

module.exports = { drawBarChart, drawProfitBar };