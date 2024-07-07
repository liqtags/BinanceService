import Binance from "node-binance-api";
import path from "node:path";
const secondarySymbol = process.env.SECONDARY_SYMBOL || "USDT";
const indicator = process.env.INDICATOR || "simple";
const minChangePercent = parseFloat(process.env.MIN_CHANGE_PERCENT || "0");
const isfixedValue = JSON.parse(process.env.USE_FIXED_TRADE_VALUE || "0");
const appMode = process.env.MODE || "DEVELOPMENT";
const interval = process.env.HEARTBEAT_INTERVAL || "1m";
const delayInterval = process.env.NEXT_TRADE_DELAY || "1m";
const isTestMode = JSON.parse(process.env.TEST_MODE as string || "false");
const delayMs = JSON.parse(process.env.DELAY || '1000');
const isFixedValue = process.env.USE_FIXED_TRADE_VALUE === 'true';
const fixedValue = parseFloat(process.env.FIXED_TRADE_VALUE || '0');
const fixedPercent = parseFloat(process.env.FIXED_TRADE_PERCENT || '0');
const changePercent = parseFloat(process.env.INDICATOR_CHANGE_PERCENT || '0');
const indicatorName = process.env.INDICATOR || 'simple';
const minTradeUsdValue = parseFloat(process.env.MIN_TRADE_USD_VALUE || '0');
const reportFileDir = process.env.REPORT_FILE_DIR;
const reportFileName = process.env.REPORT_FILE_NAME;
const comissionPercent = parseFloat(process.env.TEST_COMISSION_PERCENT);
const fileName = `${reportFileName}.csv`;
const filePath = path.join(__dirname, fileName);
const fileOptions = { flags: "a" };

const balancesInit = [{ symbol: secondarySymbol, available: 100, usdtRate: 1 }];

const options = {
    APIKEY: process.env.BINANCE_APIKEY,
    APISECRET: process.env.BINANCE_APISECRET,
    test: isTestMode,
    recvWindow: 60000,
    verbose: true,
    useServerTime: true,
    family: 4,
};

const binance = new Binance().options(options);

export {
    secondarySymbol,
    indicator,
    minChangePercent,
    isfixedValue,
    appMode,
    interval,
    delayInterval,
    isTestMode,
    delayMs,
    isFixedValue,
    fixedValue,
    fixedPercent,
    changePercent,
    indicatorName,
    minTradeUsdValue,
    balancesInit,
    options, 
    binance, 
    // report
    filePath,
    fileOptions,
    comissionPercent,
    fileName,
    reportFileDir,
    reportFileName
}