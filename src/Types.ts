type CandlestickData = [number, number, number, number, number, number];

interface TickerLimits {
    minOrderQuantity: number;
    minOrderValue: number;
    stepSize: string;
    tickerInfo: object;
}

interface PriceData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface SymbolBalance {
    symbol: string;
    available: number;
}

interface MarketOrderParams {
    primarySymbol: string;
    secondarySymbol: string;
    tickerName: string;
    secondarySymbolBalance?: number;
}

interface OrderQuantity {
    sellQuantity: number;
    buyQuantity: number;
}

interface MarketOrderResponse {
    quantity?: number;
    status?: string;
    srcData?: any;
    result: boolean;
}

interface GetCandlestickDataParams {
    tickerName: string;
    interval: string;
    periods: number;
    endTime?: number;
}

export {
    CandlestickData,
    TickerLimits,
    PriceData,
    SymbolBalance,
    MarketOrderParams,
    OrderQuantity,
    MarketOrderResponse,
    GetCandlestickDataParams
}