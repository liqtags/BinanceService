/**
 * Binance Service
 * @module BinanceService
 * @description Binance API service.
 * @author @liqtags
 * @version 0.0.1
 */
import dotenv from 'dotenv';
dotenv.config();
import util from "node:util";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import {
    TickerLimits,
    CandlestickData,
    SymbolBalance,
    MarketOrderParams,
    MarketOrderResponse,
    OrderQuantity,
    PriceData,
    GetCandlestickDataParams
} from "./Types";
import {
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
    options,
    balancesInit,
    binance, 
    filePath,
    fileOptions,
    comissionPercent
} from "./BinanceConfig";

let loopCount = 1; // Loop count
let balances = balancesInit; // Balances
let currentSymbol = null; // Current symbol in the loop
let lastTrade: any = { symbol: secondarySymbol }; // Last trade of the current symbol
let lastCheck: any = { symbol: secondarySymbol }; // Last check of the current trade
let currentSymbols = []; // Current symbols in the loop
let profitTotal = 0;
let lastPrice;
let count = 0;

import { execSync } from "child_process";
import fs from "node:fs";
import { format } from "@fast-csv/format";

/**
 * @class BinanceService
 * @description Binance API service.
 */
export class BinanceService {
    delayMs: number;
    heartbeatInterval: number;
    nextTradeDelay: number;

    constructor() {
        this.delayMs = delayMs;
        this.heartbeatInterval = this.determineHeartbeatIntervalMs(interval);
        this.nextTradeDelay = this.determineHeartbeatIntervalMs(delayInterval);
        this.createTable();
    }

    /**
     * Fetches exchange information for a given ticker.
     * @param {string} tickerName - The name of the ticker.
     * @returns {Promise<TickerLimits>} The exchange information.
     */
    async getExchangeInfoFromBinance(tickerName: string): Promise<TickerLimits> {
        try {
            await this.delay(this.delayMs);

            const data = await binance.exchangeInfo();
            const tickerInfo = data.symbols.find(
                (ticker: { symbol: string }) => ticker.symbol === tickerName
            );
            const limits: { [key: string]: any } = {};

            for (let obj of data.symbols) {
                let filters: { [key: string]: any } = { status: obj.status };

                for (let filter of obj.filters) {
                    if (filter.filterType == "MIN_NOTIONAL") {
                        filters.minNotional = filter.minNotional;
                    } else if (filter.filterType == "PRICE_FILTER") {
                        filters.minPrice = filter.minPrice;
                        filters.maxPrice = filter.maxPrice;
                        filters.tickSize = filter.tickSize;
                    } else if (filter.filterType == "LOT_SIZE") {
                        filters.stepSize = filter.stepSize;
                        filters.minQty = filter.minQty;
                        filters.maxQty = filter.maxQty;
                    }
                }

                filters.orderTypes = obj.orderTypes;
                filters.icebergAllowed = obj.icebergAllowed;
                limits[obj.symbol] = filters;
            }

            const tickerLimits = limits[tickerName];
            const minOrderQuantity = parseFloat(tickerLimits.minQty);
            const minOrderValue = parseFloat(tickerLimits.minNotional);
            const stepSize = tickerLimits.stepSize;

            return {
                minOrderQuantity,
                minOrderValue,
                stepSize,
                tickerInfo,
            };
        } catch (error) {
            throw { type: "Get Exchange Info", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches a list of trading tickers.
     * @returns {Promise<string[]>} The list of trading tickers.
     */
    async getTradingTickersFromBinance(): Promise<string[]> {
        try {
            await this.delay(this.delayMs);

            const data = await binance.exchangeInfo();
            const tickerList = data.symbols
                .filter((ticker: { status: string; isSpotTradingAllowed: boolean }) => ticker.status === "TRADING")
                .filter((ticker: { isSpotTradingAllowed: boolean }) => ticker.isSpotTradingAllowed)
                .map((ticker: { symbol: string }) => ticker.symbol);

            return tickerList;
        } catch (error) {
            throw { type: "Get Exchange Info", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches the last price for a given ticker.
     * @param {string} tickerName - The name of the ticker.
     * @returns {Promise<number>} The last price.
     */
    async getLastPriceOfTicker(tickerName: string): Promise<number> {
        try {
            await this.delay(this.delayMs);

            const priceList = await binance.prices();
            const tickerPrice = parseFloat(priceList[tickerName]);

            return tickerPrice;
        } catch (error) {
            throw { type: "Get Last Price", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches the previous day data for a given ticker.
     * @param {string} tickerName - The name of the ticker.
     * @returns {Promise<object[]>} The previous day data.
     */
    async getPreviousDaysPriceData(tickerName?: string): Promise<object[]> {
        try {
            await this.delay(this.delayMs);

            if (tickerName) {
                const data = await binance.prevDay(tickerName);
                return [data];
            } else {
                const data = await binance.prevDay(false);
                return data;
            }
        } catch (error) {
            throw { type: "Get Prev Day Data", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches the balance for a given symbol.
     * @param {string} symbolName - The name of the symbol.
     * @returns {Promise<number>} The symbol balance.
     */
    async getBalanceOfAssetOnBinance(symbolName: string): Promise<number> {
        try {
            await this.delay(this.delayMs);

            const balances = await binance.balance();
            return parseFloat(
                balances[symbolName] ? balances[symbolName].available : 0
            );
        } catch (error) {
            console.info("error:", error);
            throw { type: "Get Symbol Balance Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches the trading history for a given ticker.
     * @param {string} tickerName - The name of the ticker.
     * @returns {Promise<object[]>} The trading history.
     */
    async getTradingHistoryFromBinance(tickerName: string): Promise<object[]> {
        try {
            await this.delay(this.delayMs);

            return await binance.trades(tickerName);
        } catch (error) {
            throw { type: "Get Trading History Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches the candlestick data for a given ticker.
     * @param {GetCandlestickDataParams} params - The parameters for fetching candlestick data.
     * @returns {Promise<CandlestickData[]>} The candlestick data.
     */
    async getCandleStickDataFromBinance({
        tickerName,
        interval,
        periods,
        endTime = Date.now(),
    }: GetCandlestickDataParams): Promise<CandlestickData[]> {
        try {
            await this.delay(this.delayMs);

            const candlesticks = await binance.candlesticks(
                tickerName,
                interval,
                false,
                {
                    limit: periods,
                    endTime,
                }
            );

            const result = candlesticks.map(
                ([time, open, high, low, close, volume]: [number, string, string, string, string, string]) => {
                    return [
                        time,
                        parseFloat(open),
                        parseFloat(high),
                        parseFloat(low),
                        parseFloat(close),
                        parseFloat(volume),
                    ];
                }
            );

            return result;
        } catch (error) {
            throw { type: "Get Candlestick Data Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches the account balances.
     * @returns {Promise<SymbolBalance[]>} The account balances.
     */
    async getBinanceAccountBalances(): Promise<SymbolBalance[]> {
        try {
            await this.delay(this.delayMs);

            const balances = await binance.balance();
            const result: SymbolBalance[] = [];

            for (const symbol in balances) {
                result.push({
                    symbol,
                    available: parseFloat(balances[symbol].available),
                });
            }

            return result;
        } catch (error) {
            throw { type: "Get Account Balances Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Market buy order.
     * @param params
     * @returns {Promise<MarketOrderResponse>} The market order response.
     */
    async executeMarketBuy(params: MarketOrderParams): Promise<MarketOrderResponse> {
        const { primarySymbol, secondarySymbol, tickerName, secondarySymbolBalance } = params;

        try {
            console.info("Secondary symbol balance:", secondarySymbolBalance);

            if (isFixedValue && secondarySymbolBalance < fixedValue) {
                console.info("\n\nInsufficient balance");
                console.info(secondarySymbol, "balance must be >", fixedValue);

                return { result: false };
            } else if (
                secondarySymbolBalance <
                (secondarySymbolBalance / 100) * fixedPercent
            ) {
                console.info("\n\nInsufficient balance");
                console.info(
                    secondarySymbol,
                    "balance must be >",
                    (secondarySymbolBalance / 100) * fixedPercent
                );
                return { result: false };
            }

            const { buyQuantity } = await this.calculateOrderQuantity({
                primarySymbol,
                secondarySymbol,
                tickerName,
                secondarySymbolBalance
            });

            if (buyQuantity === 0) {
                return { result: false };
            }

            await this.delay(delayMs);
            const response = await binance.marketBuy(tickerName, buyQuantity);

            return {
                quantity: parseFloat(response.executedQty),
                status: response.status,
                srcData: response,
                result: true,
            };
        } catch (error) {
            throw { type: "Market Buy Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Market sell order.
     * @param params
     * @returns {Promise<MarketOrderResponse>} The market order response.
    */
    async executeMarketSell(params: MarketOrderParams): Promise<MarketOrderResponse> {
        const { primarySymbol, secondarySymbol, tickerName, secondarySymbolBalance } = params;

        try {
            const { sellQuantity } = await this.calculateOrderQuantity({
                primarySymbol,
                secondarySymbol,
                tickerName,
                secondarySymbolBalance
            });

            if (sellQuantity === 0) {
                return { result: false };
            }

            await this.delay(delayMs);
            const response = await binance.marketSell(tickerName, sellQuantity);

            return {
                quantity: response.executedQty,
                status: response.status,
                srcData: response,
                result: true,
            };
        } catch (error) {
            throw { type: "Market Sell Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Get order quantity.
     * @param params
     * @returns {Promise<OrderQuantity>} The order quantity.
    */
    async calculateOrderQuantity(params: MarketOrderParams): Promise<OrderQuantity> {
        const { primarySymbol, secondarySymbol, tickerName, secondarySymbolBalance } = params;

        try {
            await this.delay(delayMs);

            const primarySymbolBalance = await this.getBalanceOfAssetOnBinance(primarySymbol);
            const { minOrderQuantity, minOrderValue, stepSize } = await this.getExchangeInfoFromBinance(tickerName);

            const price = await this.getLastPriceOfTicker(tickerName);
            console.info("price:", price);

            // Buy quantity
            let buyQuantity: number;

            if (isFixedValue) {
                console.info("\nFixed Volume:", fixedValue);

                buyQuantity = await binance.roundStep(
                    fixedValue / price - parseFloat(stepSize),
                    stepSize
                );
            } else {
                console.info("\nFixed Percent:", fixedPercent);

                buyQuantity = await binance.roundStep(
                    (secondarySymbolBalance / price / 100) * fixedPercent,
                    stepSize
                );
            }

            console.info("buyQuantity:", buyQuantity);

            const insufficientBalanceToBuy =
                buyQuantity < minOrderQuantity || buyQuantity * price < minOrderValue;

            console.info("insufficientBalanceToBuy:", insufficientBalanceToBuy);

            if (insufficientBalanceToBuy) {
                buyQuantity = 0;
            }

            // Sell quantity
            let sellQuantity = await binance.roundStep(primarySymbolBalance, stepSize);

            const insufficientBalanceToSell =
                sellQuantity < minOrderQuantity || sellQuantity * price < minOrderValue;

            console.info("insufficientBalanceToSell:", insufficientBalanceToSell);

            if (insufficientBalanceToSell) {
                sellQuantity = 0;
            }

            console.info("primarySymbolBalance:", primarySymbolBalance);
            console.info("secondarySymbolBalance:", secondarySymbolBalance);
            console.info("minOrderQuantity:", minOrderQuantity);
            console.info("minOrderValue:", minOrderValue);
            console.info("sellQuantity:", sellQuantity);
            console.info("buyQuantity:", buyQuantity);
            console.info("stepSize:", stepSize);

            return { sellQuantity, buyQuantity: buyQuantity };
        } catch (error) {
            throw { type: "Get Order Quantity Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Fetches the price data for a given ticker.
     * @param primarySymbol
     * @param secondarySymbol
     * @param interval
     * @param priceChangePercent
     * @returns 
     */
    async processChartData({
        primarySymbol,
        secondarySymbol,
        interval,
        priceChangePercent,
    }) {
        const tickerName = primarySymbol + secondarySymbol;

        const candlestickData = await this.getCandleStickDataFromBinance({
            tickerName,
            interval,
            periods: 45,
        });

        const xyData = candlestickData.map(([time, close]) => [
            time,
            parseFloat(close as any),
        ]);

        const priceData = xyData
            .map(([time, close]) => ({ x: time, y: close }))
            .slice(-45);

        const imageBuffer = await this.drawChartImage({
            primarySymbol,
            secondarySymbol,
            priceData,
            priceChangePercent,
        });

        return imageBuffer;
    }

    /**
     * Renders the chart.
     * @param primarySymbol
     * @param secondarySymbol
     * @param priceData
     * @param priceChangePercent
     * @returns <Promise<Buffer>> The chart image buffer.
     */
    async drawChartImage({
        primarySymbol,
        secondarySymbol,
        priceData,
        priceChangePercent,
    }): Promise<Buffer> {
        const width = 500;
        const height = 300;

        const chartCallback = (ChartJS) => {
            ChartJS.defaults.global.elements.rectangle.borderWidth = 2;
        };

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            chartCallback,
        });

        const plugin = {
            id: "custom_canvas_background_color",
            beforeDraw: (chart) => {
                const ctx = chart.canvas.getContext("2d");
                ctx.save();
                ctx.globalCompositeOperation = "destination-over";
                2;
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, chart.width, chart.height);
                ctx.restore();
            },
        };

        const configuration = {
            type: "line",
            data: {
                labels: priceData.map(({ x }) => x),
                datasets: [
                    {
                        label: `${primarySymbol} / ${secondarySymbol} ${priceChangePercent
                            ? " - 24H gain " + Math.floor(priceChangePercent) + "%"
                            : ""
                            }`,
                        data: priceData,
                        borderColor: "#598381",
                        borderWidth: 2,
                        lineTension: 0,
                        fill: false,
                        pointRadius: 1,
                    },
                ],
            },
            options: {
                scales: {
                    xAxes: [
                        {
                            ticks: {
                                callback: (x) => this.formatDate(x),
                            },
                        },
                    ],
                },
            },
            plugins: [plugin],
        };

        //@ts-expect-error
        return await chartJSNodeCanvas.renderToBuffer(configuration, "image/png");
    }

    /**
     * Formats the date.
     * @param timestamp
     * @returns string
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);

        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear().toString().slice(-2);
        // const hours = date.getHours().toString().padStart(2, "0");
        // const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${day}.${month}.${year}`;
    }

    /**
     * Parses the interval.
     * @param interval
     * @returns number
     */
    parseInterval(interval) {
        const match = interval.match(/^(\d+)(s|m|h)$/);
        if (!match) {
            throw new Error(`Invalid interval format: ${interval}`);
        }
        const value = parseInt(match[1], 10);
        const unit = match[2];
        if (value < 1 || value > 60) {
            throw new Error(`Invalid interval value: ${value}`);
        }
        if (unit !== "s" && unit !== "m" && unit !== "h") {
            throw new Error(`Invalid interval unit: ${unit}`);
        }
        const values = {
            s: value * 1000,
            m: value * 60 * 1000,
            h: value * 60 * 60 * 1000,
        };
        return values[unit];
    }

    /**
     * Get the heartbeat interval.
     * @param interval 
     * @returns 
     */
    determineHeartbeatIntervalMs(interval) {
        const intervalMs = this.parseInterval(interval);
        return intervalMs;
    }

    /**
     * Monitor for dump trade signals. 
     * @param secondarySymbol
     * @param currentSymbol
     * @param lastTrade
     * @param lastCheck
     */
    async useDumpTradeSignal({
        secondarySymbol,
        currentSymbol,
        lastTrade,
        lastCheck,
    }): Promise<any> {
        try {
            const btcUsdtPrice = await this.getLastPriceOfTicker("BTCUSDT");

            const tradingTickers = await this.getTradingTickersFromBinance();

            const priceListData: any = await this.getPreviousDaysPriceData();

            const tickerList = priceListData
                .map(
                    ({
                        symbol,
                        priceChangePercent,
                        lastPrice,
                        openTime,
                        closeTime,
                        ...others
                    }) => ({
                        primarySymbol: symbol.split(secondarySymbol)[0],
                        secondarySymbol,
                        tickerName: symbol,
                        priceChangePercent: parseFloat(priceChangePercent),
                        lastPrice: parseFloat(lastPrice),
                        openTime,
                        closeTime,
                        ...others,
                    })
                )
                .filter(({ tickerName }) => tickerName.endsWith(secondarySymbol))
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("DOWN"))
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("UP"));

            const filteredListForMarketChange = tickerList
                .filter(({ tickerName }) => tickerName.endsWith(secondarySymbol))
                .filter(({ tickerName }) => tradingTickers.includes(tickerName));

            const tickerListToBuy = tickerList

                .filter(({ primarySymbol }) =>
                    tradingTickers.includes(primarySymbol + secondarySymbol)
                )
                .filter(({ primarySymbol }) => primarySymbol !== lastTrade.symbol)
                .filter(({ primarySymbol }) => primarySymbol !== currentSymbol)
                .sort((a, b) => b.priceChangePercent - a.priceChangePercent);

            const marketAveragePrice = filteredListForMarketChange.reduce(
                (sum, { lastPrice }, index, array) => {
                    sum = sum + parseFloat(lastPrice);

                    if (index === array.length - 1) {
                        return (sum - btcUsdtPrice) / array.length;
                    } else {
                        return sum;
                    }
                },
                0
            );

            const tickerToBuy = tickerListToBuy[tickerListToBuy.length - 1];
            const buyPrimarySymbol = tickerToBuy.primarySymbol;
            const buyTickerName = tickerToBuy.tickerName;
            const buyPrice = tickerToBuy && parseFloat(tickerToBuy.lastPrice);
            const buyTickerPriceChangePercent = tickerToBuy.priceChangePercent;
            const buyCondition = !currentSymbol;
            const isBuySignal = buyCondition;
            const tickerToSell = tickerList.find(
                ({ primarySymbol }) => primarySymbol === currentSymbol
            );

            const sellPrimarySymbol = tickerToSell?.primarySymbol;
            const sellTickerName = tickerToSell?.tickerName;
            const sellPrice = tickerToSell && parseFloat(tickerToSell.lastPrice);
            const sellTickerPriceChangePercent = tickerToSell?.priceChangePercent;
            const sellCondition1 = lastCheck.symbol === currentSymbol;
            const sellCondition2 = sellPrice < lastCheck.price;
            const isSellSignal = sellCondition1 && sellCondition2;

            const result = {
                sellPrimarySymbol,
                buyPrimarySymbol,
                sellTickerName,
                buyTickerName,
                buyPrice,
                sellPrice,
                buyTickerPriceChangePercent,
                sellTickerPriceChangePercent,
                isBuySignal,
                isSellSignal,
                btcUsdtPrice,
                marketAveragePrice,
            };

            return result;
        } catch (error) {
            throw { type: "Get Trade Signals Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Monitor for pump trade signals.
     * @param secondarySymbol
     * @param currentSymbol
     * @param lastTrade
     * @param lastCheck
     */
    async usePumpTradeSignal({
        secondarySymbol,
        currentSymbol,
        lastTrade,
        lastCheck,
    }): Promise<any> {
        try {
            // BTC / USDT
            const btcUsdtPrice = await this.getLastPriceOfTicker("BTCUSDT");

            const tradingTickers = await this.getTradingTickersFromBinance();

            const priceListData: any = await this.getPreviousDaysPriceData();

            const tickerList = priceListData
                .map(
                    ({
                        symbol,
                        priceChangePercent,
                        lastPrice,
                        openTime,
                        closeTime,
                        ...others
                    }) => ({
                        primarySymbol: symbol.split(secondarySymbol)[0],
                        secondarySymbol,
                        tickerName: symbol,
                        priceChangePercent: parseFloat(priceChangePercent),
                        lastPrice: parseFloat(lastPrice),
                        openTime,
                        closeTime,
                        ...others,
                    })
                )
                .filter(({ tickerName }) => tickerName.endsWith(secondarySymbol))
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("DOWN"))
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("UP"));

            const tickerListToBuy = tickerList
                .filter(({ primarySymbol }) =>
                    tradingTickers.includes(primarySymbol + secondarySymbol)
                )
                .filter(({ primarySymbol }) => primarySymbol !== lastTrade.symbol)
                .filter(({ primarySymbol }) => primarySymbol !== currentSymbol)
                .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
                .filter(({ priceChangePercent }) => priceChangePercent > changePercent);

            //
            // Buy signal
            const tickerToBuy = tickerListToBuy.reverse()[0];
            const buyPrimarySymbol = tickerToBuy?.primarySymbol;
            const buyTickerName = tickerToBuy?.tickerName;
            const buyPrice = parseFloat(tickerToBuy?.lastPrice);
            const buyTickerPriceChangePercent = tickerToBuy?.priceChangePercent;
            const buyCondition = !currentSymbol && tickerToBuy;
            const isBuySignal = buyCondition;

            // console.log("tickerToBuy:", tickerToBuy);
            // console.log("changePercent:", tickerToBuy.priceChangePercent);

            //
            // Sell signal
            const tickerToSell = tickerList.find(
                ({ primarySymbol }) => primarySymbol === currentSymbol
            );

            const sellPrimarySymbol = tickerToSell?.primarySymbol;
            const sellTickerName = tickerToSell?.tickerName;
            const sellPrice = parseFloat(tickerToSell?.lastPrice);
            const sellTickerPriceChangePercent = tickerToSell?.priceChangePercent;
            const sellCondition1 = lastCheck.symbol === currentSymbol;
            const sellCondition2 = sellPrice < lastCheck.price;
            const isSellSignal = sellCondition1 && sellCondition2;

            // Market average
            const marketAveragePrice = tickerList
                .filter(({ primarySymbol }) =>
                    tradingTickers.includes(primarySymbol + secondarySymbol)
                )
                .reduce((sum, { lastPrice }, index, array) => {
                    sum = sum + parseFloat(lastPrice);

                    if (index === array.length - 1) {
                        return (sum - btcUsdtPrice) / array.length;
                    } else {
                        return sum;
                    }
                }, 0);

            //
            // Result
            const result = {
                sellPrimarySymbol,
                buyPrimarySymbol,
                sellTickerName,
                buyTickerName,
                buyPrice,
                sellPrice,
                buyTickerPriceChangePercent,
                sellTickerPriceChangePercent,
                isBuySignal,
                isSellSignal,
                btcUsdtPrice,
                marketAveragePrice,
            };

            console.info("\nCheck signals result:", {
                buySignal: {
                    buyPrimarySymbol,
                    buyTickerName,
                    buyPrice,
                    buyTickerPriceChangePercent,
                    isBuySignal,
                },
                sellSignal: {
                    sellPrimarySymbol,
                    sellTickerName,
                    sellPrice,
                    sellTickerPriceChangePercent,
                    isSellSignal,
                },
            });

            return result;
        } catch (error) {
            throw { type: "Get Trade Signals Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Monitor flat trade signals.
     * @param secondarySymbol
     * @param currentSymbol
     * @param lastTrade
     * @param lastCheck
     */
    async useFlatTradeSignal({
        secondarySymbol,
        currentSymbol,
        lastTrade,
        lastCheck,
    }): Promise<any> {
        try {
            const tradingTickers = await this.getTradingTickersFromBinance();

            const priceListData: any = await this.getPreviousDaysPriceData();

            const tickerList = priceListData
                .map(
                    ({
                        symbol,
                        priceChangePercent,
                        lastPrice,
                        openTime,
                        closeTime,
                        ...others
                    }) => ({
                        primarySymbol: symbol.split(secondarySymbol)[0],
                        secondarySymbol,
                        tickerName: symbol,
                        priceChangePercent: parseFloat(priceChangePercent),
                        lastPrice: parseFloat(lastPrice),
                        openTime,
                        closeTime,
                        ...others,
                    })
                )
                .filter(({ tickerName }) => tickerName.endsWith(secondarySymbol))
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("DOWN"))
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("UP"));

            const tickerListToBuy = tickerList
                .filter(({ tickerName }) => tickerName.endsWith(secondarySymbol))
                .filter(({ primarySymbol }) =>
                    tradingTickers.includes(primarySymbol + secondarySymbol)
                )
                .filter(({ primarySymbol }) => primarySymbol !== lastTrade.symbol)
                .filter(({ primarySymbol }) => primarySymbol !== currentSymbol)
                .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
                .filter(({ priceChangePercent }) => priceChangePercent < 0);

            //
            // Buy signal
            const tickerToBuy = tickerListToBuy[0];
            const buyPrimarySymbol = tickerToBuy.primarySymbol;
            const buyTickerName = tickerToBuy.tickerName;
            const buyPrice = tickerToBuy && parseFloat(tickerToBuy.lastPrice);
            const buyTickerPriceChangePercent = tickerToBuy.priceChangePercent;
            const buyCondition = !currentSymbol;
            const isBuySignal = buyCondition;

            //
            // Sell signal
            const tickerToSell = tickerList.find(
                ({ primarySymbol }) => primarySymbol === currentSymbol
            );

            const sellPrimarySymbol = tickerToSell?.primarySymbol;
            const sellTickerName = tickerToSell?.tickerName;
            const sellPrice = tickerToSell && parseFloat(tickerToSell.lastPrice);
            const sellTickerPriceChangePercent = tickerToSell?.priceChangePercent;
            const sellCondition1 = lastCheck.symbol === currentSymbol;
            const sellCondition2 = sellPrice < lastCheck.price;
            const isSellSignal = sellCondition1 && sellCondition2;

            // BTC / USDT
            const btcUsdtPrice = await this.getLastPriceOfTicker("BTCUSDT");

            // Market average
            const filteredListForMarketChange = tickerList.filter(({ primarySymbol }) =>
                tradingTickers.includes(primarySymbol + secondarySymbol)
            );

            const marketAveragePrice = filteredListForMarketChange.reduce(
                (sum, { lastPrice }, index, array) => {
                    sum = sum + parseFloat(lastPrice);

                    if (index === array.length - 1) {
                        return (sum - btcUsdtPrice) / array.length;
                    } else {
                        return sum;
                    }
                },
                0
            );

            //
            // Result
            const result = {
                sellPrimarySymbol,
                buyPrimarySymbol,
                sellTickerName,
                buyTickerName,
                buyPrice,
                sellPrice,
                buyTickerPriceChangePercent,
                sellTickerPriceChangePercent,
                isBuySignal,
                isSellSignal,
                btcUsdtPrice,
                marketAveragePrice,
            };

            return result;
        } catch (error) {
            throw { type: "Get Trade Signals Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Monitor for simple trade signals.
     */
    async useSimpleTradeSignal({ secondarySymbol, currentSymbol }): Promise<any> {
        try {
            const tradingTickers = await this.getTradingTickersFromBinance();

            const priceListData: any = await this.getPreviousDaysPriceData();

            const tickerList = priceListData
                .map(
                    ({
                        symbol,
                        priceChangePercent,
                        lastPrice,
                        openTime,
                        closeTime,
                        ...others
                    }) => ({
                        primarySymbol: symbol.split(secondarySymbol)[0],
                        secondarySymbol,
                        tickerName: symbol,
                        priceChangePercent: parseFloat(priceChangePercent),
                        lastPrice: parseFloat(lastPrice),
                        openTime,
                        closeTime,
                        ...others,
                    })
                )
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("DOWN"))
                .filter(({ primarySymbol }) => !primarySymbol.endsWith("UP"));

            //
            // Buy signal
            const tickerToBuy = tickerList.find(
                ({ primarySymbol }) => primarySymbol === process.env.PRIMARY_SYMBOL
            );
            const buyPrimarySymbol = tickerToBuy.primarySymbol;
            const buyTickerName = tickerToBuy.tickerName;
            const buyPrice = tickerToBuy && parseFloat(tickerToBuy.lastPrice);
            const buyTickerPriceChangePercent = tickerToBuy.priceChangePercent;
            const isBuySignal = !currentSymbol;

            //
            // Sell signal
            const tickerToSell = tickerList.find(
                ({ primarySymbol }) => primarySymbol === currentSymbol
            );
            const sellPrimarySymbol = tickerToSell?.primarySymbol;
            const sellTickerName = tickerToSell?.tickerName;
            const sellPrice = tickerToSell && parseFloat(tickerToSell.lastPrice);
            const sellTickerPriceChangePercent = tickerToSell?.priceChangePercent;
            const isSellSignal = true;

            // BTC / USDT
            const btcUsdtPrice = await this.getLastPriceOfTicker("BTCUSDT");

            // Market average
            const marketAveragePrice = tickerList
                .filter(({ tickerName }) => tickerName.endsWith(secondarySymbol))
                .filter(({ primarySymbol }) =>
                    tradingTickers.includes(primarySymbol + secondarySymbol)
                )
                .reduce((sum, { lastPrice }, index, array) => {
                    sum = sum + parseFloat(lastPrice);

                    if (index === array.length - 1) {
                        return (sum - btcUsdtPrice) / array.length;
                    } else {
                        return sum;
                    }
                }, 0);

            const result = {
                sellPrimarySymbol,
                buyPrimarySymbol,
                sellTickerName,
                buyTickerName,
                buyPrice,
                sellPrice,
                buyTickerPriceChangePercent,
                sellTickerPriceChangePercent,
                isBuySignal,
                isSellSignal,
                btcUsdtPrice,
                marketAveragePrice,
            };
            return result;
        } catch (error) {
            throw { type: "Get Trade Signals Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Runs in TEST mode.
     */
    async runTestMode() {
        console.log("\nTEST mode is active");
        try {
            await this.startTestServer();
            await this.startTestLoop();
        } catch (error) {
            const { statusCode, statusMessage, body, type, errorSrcData } = error;

            if (statusCode) {
                console.error(
                    `\nType: ${type || ""}\nStatus message: ${statusMessage || ""}\nBody: ${JSON.parse(body).msg
                    }`
                );

                console.info(
                    `Error source data:`,
                    util.inspect(errorSrcData, {
                        showHidden: false,
                        depth: null,
                        colors: true,
                    })
                );

                // await sendMessage(`<b>${type || ""}:</b>\n${JSON.parse(body).msg}`);
                console.log("Error:", error);
            } else {
                console.info(
                    `\nUnexpected Error:`,
                    util.inspect(error, {
                        showHidden: false,
                        depth: null,
                        colors: true,
                    })
                );
                console.info(
                    `Error source data:`,
                    util.inspect(errorSrcData, {
                        showHidden: false,
                        depth: null,
                        colors: true,
                    })
                );

                console.log("Error:", error);

                // await sendMessage(
                //   `<b>Unexpected Error:</b> Look at the server logs for details`
                // );
            }
        }
    }

    /**
     * Starts the test server.
     */
    async startTestServer() {
        try {
            console.info(`${secondarySymbol} Bot started`);

            // Disable console output for PRODUCTION mode
            if (appMode === "PRODUCTION") console.info = () => { };

            console.info("Heartbeat interval:", interval);
            console.info("Using indicator:", indicator);

            let startMessage = `<b>${secondarySymbol} Bot started</b>\n\n`;
            startMessage += `<b>Chart Interval:</b> 1d\n`;
            startMessage += `<b>Hearbeat interval:</b> ${interval}\n`;

            //   await sendMessage(startMessage);
            console.log(startMessage);
        } catch (error) {
            throw { type: "Start Server Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Starts the test loop.
     */
    async startTestLoop() {
        try {
            while (loopCount) {
                console.info("\n");
                console.info("-----------------------------------------------------");
                console.info("Loop start:", loopCount);

                if (appMode === "DEVELOPMENT") console.time("Loop Time");

                console.info("-----------------------------------------------------");

                await this.testHeartBeatLoop();

                console.info("\n");
                console.info("-----------------------------------------------------");
                console.info("Loop end:", loopCount);

                if (appMode === "DEVELOPMENT") console.timeEnd("Loop Time");

                console.info("-----------------------------------------------------");
                console.info("\n");

                await this.delay(!currentSymbol ? this.nextTradeDelay : this.heartbeatInterval);

                loopCount++;
            }
        } catch (error) {
            throw { type: "Start Loop Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Test the heartbeat loop.
     */
    async testHeartBeatLoop() {
        try {
            let message = "";

            const accountBalances = balances;

            const usdtRateTotalBalance = accountBalances.reduce((sum, balance) => {
                sum += balance.usdtRate;
                return sum;
            }, 0);

            const {
                sellPrimarySymbol,
                buyPrimarySymbol,
                sellPrice,
                buyPrice,
                sellTickerPriceChangePercent,
                buyTickerPriceChangePercent,
                isSellSignal,
                isBuySignal,
                btcUsdtPrice,
                marketAveragePrice,
            } = await this.getSignalsBasedOnType({
                secondarySymbol,
                currentSymbol,
                accountBalance: usdtRateTotalBalance,
                minOrderValue: isfixedValue
                    ? fixedValue
                    : (usdtRateTotalBalance / 100) * fixedPercent,
                minChangePercent,
                lastTrade,
                lastCheck,
            });

            if (isSellSignal && currentSymbol) {
                console.info("\n");
                console.info("Sell condition:", true);

                if (currentSymbol) {
                    currentSymbol = null;
                }

                const newPrimarySymbolBalance = 0;

                lastCheck = { symbol: secondarySymbol, price: 1 };

                const chart = await this.processChartData({
                    primarySymbol: sellPrimarySymbol,
                    secondarySymbol,
                    interval: "1d",
                    priceChangePercent: sellTickerPriceChangePercent,
                });

                message += `<b>${sellPrimarySymbol} price</b>: ${parseFloat(
                    sellPrice
                )} ${secondarySymbol}\n`;
                message += `<b>Sold</b>: 1 ${sellPrimarySymbol}\n\n`;
                message += `<b>${sellPrimarySymbol} balance</b>: ${parseFloat(
                    newPrimarySymbolBalance as any
                )}`;

                this.reportTradeAction({
                    date: new Date(),
                    trade: "SELL",
                    symbol: sellPrimarySymbol,
                    price: sellPrice,
                    priceChangePercent: sellTickerPriceChangePercent,
                    btcUsdtPrice,
                    marketAveragePrice,
                });

                await this.sendTelegramMessage(message);
                console.log("message:", message);
            } else if (isBuySignal && !currentSymbol) {
                console.info("\n");
                console.info("Buy condition:", true);

                const primarySymbolUsdtPrice = await this.getLastPriceOfTicker(
                    buyPrimarySymbol + "USDT"
                );

                const chart = await this.processChartData({
                    primarySymbol: buyPrimarySymbol,
                    secondarySymbol,
                    interval: "1d",
                    priceChangePercent: buyTickerPriceChangePercent,
                });

                const newPrimarySymbolBalance = 1;

                balances = [
                    {
                        symbol: buyPrimarySymbol,
                        available: 1,
                        usdtRate: primarySymbolUsdtPrice,
                    },
                    {
                        symbol: secondarySymbol,
                        available: 0,
                        usdtRate: 1,
                    },
                ];

                currentSymbol = buyPrimarySymbol;
                lastTrade = { symbol: buyPrimarySymbol, price: buyPrice };
                lastCheck = lastTrade;

                console.info("\n\nNew current symbol:", currentSymbol);

                message += `<b>${buyPrimarySymbol} price</b>: ${parseFloat(
                    buyPrice
                )} ${secondarySymbol}\n`;
                message += `<b>Bought</b>: ${newPrimarySymbolBalance} ${buyPrimarySymbol}\n\n`;
                message += `<b>${buyPrimarySymbol} balance</b>: ${parseFloat(
                    newPrimarySymbolBalance as any
                )}`;

                this.reportTradeAction({
                    date: new Date(),
                    trade: "BUY",
                    symbol: buyPrimarySymbol,
                    price: buyPrice,
                    priceChangePercent: buyTickerPriceChangePercent,
                    btcUsdtPrice,
                    marketAveragePrice,
                });

                // await sendImage(chart);
                await this.sendTelegramMessage(message);
                console.log("message:", message);
            } else {
                lastCheck = { symbol: sellPrimarySymbol, price: sellPrice };

                this.reportTradeAction({
                    date: new Date(),
                    trade: "PASS",
                    symbol: lastCheck.sellPrimarySymbol,
                    price: lastCheck.price,
                    priceChangePercent: sellTickerPriceChangePercent,
                    btcUsdtPrice,
                    marketAveragePrice,
                });
            }

            console.info("\n\nCurrent symbol:", currentSymbol);
            console.info("\nlastCheck:", lastCheck);
        } catch (error) {
            throw { type: "Heartbeat Loop Error", ...error, errorSrcData: error };
        }
    }

    /**
     * Get the Signals based on the indicator mode. 
     * @returns 
     */
    getSignalsBasedOnType = (obj) => {
        switch (indicatorName) {
            case "dump":
                return this.useDumpTradeSignal(obj) as any;
            case "flat":
                return this.useFlatTradeSignal(obj) as any;
            case "pump":
                return this.usePumpTradeSignal(obj) as any;
            case "simple":
                return this.useSimpleTradeSignal(obj) as any;
        }
    };

    async startReal() {
        console.log("\nREAL mode is active");
        console.info(`${secondarySymbol} Bot started`);

        // Disable console output for PRODUCTION mode
        if (appMode === "PRODUCTION") console.info = () => { };

        try {
            await this.startRealServer();
        } catch (error) {
            const { statusCode, statusMessage, body, type, errorSrcData } = error;

            if (statusCode) {
                console.error(
                    `\nType: ${type || ""}\nStatus message: ${statusMessage || ""}\nBody: ${JSON.parse(body).msg
                    }`
                );

                console.info(`Error source data:`, errorSrcData);

                await this.sendTelegramMessage(`<b>${type || ""}:</b>\n${JSON.parse(body).msg}`);
            } else {
                console.info(`\nUnexpected Error:`, error);
                console.info(`Error source data:`, errorSrcData);

                await this.sendTelegramMessage(
                    `<b>Unexpected Error:</b> Look server logs for details`
                );
            }
        }
    }

    async startRealServer() {
        try {
            console.info("\n");
            console.info(`${secondarySymbol} Bot started`);

            console.info("Heartbeat interval:", interval);
            console.info("Using indicator:", indicator);

            let startMessage = `<b>${secondarySymbol} Surfer Bot started</b>\n\n`;
            startMessage += `<b>Chart Interval:</b> 1d\n`;
            startMessage += `<b>Hearbeat interval:</b> ${interval}\n`;
            await this.sendTelegramMessage(startMessage);

            await this.getStartupBalances();
            await this.startRealLoop();
        } catch (error) {
            throw { type: "Start Server Error", ...error, errorSrcData: error };
        }
    }

    async getStartupBalances() {
        try {
            const balances = await this.getAccountBalances();

            const filteredBalances = balances.filter(({ usdtRate }) => {
                // ToDo: use min value from Binance instead of fixed number
                return usdtRate > minTradeUsdValue;
            });

            console.info("\nAccount Balances:", filteredBalances);

            const currentSymbols = filteredBalances
                .map((balance) => balance.symbol)
                .filter((symbol) => symbol !== secondarySymbol);

            console.info("\ncurrentSymbols:", currentSymbols);
            console.info("\nSelected currentSymbol", currentSymbol);

            let message = `<b>Current account balances:</b>\n\n`;

            let sum = 0;

            for (const balance of balances) {
                sum += balance.usdtRate;
                message += `<b>${balance.available} ${balance.symbol
                    }</b> = ${balance.usdtRate.toFixed(2)} USDT \n`;
            }

            message += `\n<b>USDT rate total balance:</b> ${sum.toFixed(2)} USDT \n`;

            await this.sendTelegramMessage(message);
        } catch (error) {
            throw { type: "Get Startup Balances Error", ...error, errorSrcData: error };
        }
    }

    async startRealLoop() {
        try {
            while (loopCount) {
                console.info("\n");
                console.info("-----------------------------------------------------");
                console.info("Loop start:", loopCount);

                if (appMode === "DEVELOPMENT") console.time("Loop Time");

                console.info("-----------------------------------------------------");

                await this.realHeartBeatLoop();

                console.info("\n");
                console.info("-----------------------------------------------------");
                console.info("Loop end:", loopCount);

                if (appMode === "DEVELOPMENT") console.timeEnd("Loop Time");

                console.info("-----------------------------------------------------");
                console.info("\n");

                await this.delay(!currentSymbol ? this.nextTradeDelay : this.heartbeatInterval);

                loopCount++;
            }
        } catch (error) {
            throw { type: "Start Loop Error", ...error, errorSrcData: error };
        }
    }

    async realHeartBeatLoop() {
        try {
            let message = "";

            const accountBalances = await this.getAccountBalances();

            const usdtRateTotalBalance = accountBalances.reduce((sum, balance) => {
                sum += balance.usdtRate;
                return sum;
            }, 0);

            const {
                sellPrimarySymbol,
                buyPrimarySymbol,
                sellTickerName,
                buyTickerName,
                sellPrice,
                buyPrice,
                sellTickerPriceChangePercent,
                buyTickerPriceChangePercent,
                isSellSignal,
                isBuySignal,
            } = await this.getSignalsBasedOnType({
                secondarySymbol,
                currentSymbol,
                accountBalance: usdtRateTotalBalance,
                minOrderValue: isfixedValue
                    ? fixedValue
                    : (usdtRateTotalBalance / 100) * fixedPercent,
                minChangePercent,
                lastTrade,
                lastCheck,
            });

            const secondarySymbolUsdtPrice =
                secondarySymbol === "USDT"
                    ? 1
                    : await this.getLastPriceOfTicker(secondarySymbol + "USDT");

            if (isSellSignal) {
                console.info("\n");
                console.info("\n\nCheck", sellTickerName);
                console.info("Sell condition:", isSellSignal);

                message += "<b>Sell signal</b>\n\n";

                const { quantity, status, srcData, result } = await this.executeMarketSell({
                    primarySymbol: sellPrimarySymbol,
                    secondarySymbol,
                    tickerName: sellTickerName,
                });

                if (!result) {
                    console.info(`No trade result`);
                    return;
                }

                console.info(`Trade result:`, status);

                if (status !== "FILLED" || isNaN(quantity)) {
                    console.info(`Unexpected result. Response data:`, srcData);
                    message += `Unexpected result. Check server logs for details.\n`;

                    await this.sendTelegramMessage(message);
                    return;
                }

                const chart = await this.processChartData({
                    primarySymbol: sellPrimarySymbol,
                    secondarySymbol,
                    interval: "1d",
                    priceChangePercent: sellTickerPriceChangePercent,
                });

                const newPrimarySymbolBalance = await this.getBalanceOfAssetOnBinance(sellPrimarySymbol);
                const newSecondarySymbolBalance = await this.getBalanceOfAssetOnBinance(secondarySymbol);
                const primarySymbolUsdtPrice = await this.getLastPriceOfTicker(
                    sellPrimarySymbol + "USDT"
                );

                if (currentSymbol) {
                    currentSymbol = null;
                }

                lastCheck = { symbol: secondarySymbol, price: 1 };

                const accountBalances = await this.getAccountBalances();

                console.info("accountBalance:", accountBalances);

                const usdtRateTotalBalance = accountBalances.reduce((sum, balance) => {
                    sum += balance.usdtRate;
                    return sum;
                }, 0);

                console.info("New balance:\n");
                console.info(`${newPrimarySymbolBalance} ${sellPrimarySymbol}`);
                console.info(`${newSecondarySymbolBalance} ${secondarySymbol}`);
                console.info(`${sellPrimarySymbol} price: ${primarySymbolUsdtPrice}`);
                console.info(`${secondarySymbol} price: ${secondarySymbolUsdtPrice}`);

                console.info(
                    `USDT rate total balance: ${usdtRateTotalBalance.toFixed(2)}`
                );

                message += `<b>${sellPrimarySymbol} price</b>: ${parseFloat(
                    sellPrice
                )} ${secondarySymbol}\n`;
                message += `<b>Sold</b>: ${quantity} ${sellPrimarySymbol}\n\n`;
                message += `<b>${sellPrimarySymbol} balance</b>: ${parseFloat(
                    newPrimarySymbolBalance as any
                )}\n`;
                message += `<b>${secondarySymbol} balance</b>: ${newSecondarySymbolBalance}\n\n`;
                message += `<b>USDT rate total balance</b>: ${usdtRateTotalBalance.toFixed(
                    2
                )}`;

                console.info("Trade accomplished");

                // await sendImage(chart);
                // await sendMessage(message);
                await this.sendTelegramMessage(message);
            } else if (isBuySignal) {
                console.info("\n");
                console.info("\n\nCheck", buyTickerName);
                console.info("Buy condition:", isBuySignal);

                message += `<b>Buy signal</b>\n\n`;

                const primarySymbolUsdtPrice = await this.getLastPriceOfTicker(
                    buyPrimarySymbol + "USDT"
                );
                const secondarySymbolBalance = await this.getBalanceOfAssetOnBinance(secondarySymbol);

                const { quantity, status, srcData, result } = await this.executeMarketBuy({
                    primarySymbol: buyPrimarySymbol,
                    secondarySymbol,
                    tickerName: buyTickerName,
                    secondarySymbolBalance,
                });

                console.info("\n");
                console.info(`status:`, status);
                console.info(`quantity:`, quantity);
                console.info(`result:`, result);

                if (!result) {
                    console.info(`No trade result.`);
                    return;
                }

                if (status !== "FILLED" || isNaN(quantity)) {
                    console.info(`Unexpected result. Response data:`, srcData);
                    message += `Unexpected result. Check server logs for details.\n`;

                    await this.sendTelegramMessage(message);

                    return;
                }

                const chart = await this.processChartData({
                    primarySymbol: buyPrimarySymbol,
                    secondarySymbol,
                    interval: "1d",
                    priceChangePercent: buyTickerPriceChangePercent,
                });

                currentSymbols.push(buyPrimarySymbol);

                const newPrimarySymbolBalance = await this.getBalanceOfAssetOnBinance(buyPrimarySymbol);
                const newSecondarySymbolBalance = await this.getBalanceOfAssetOnBinance(secondarySymbol);
                const accountBalances = await this.getAccountBalances();

                console.info("accountBalances:", accountBalances);

                const usdtRateTotalBalance = accountBalances.reduce((sum, balance) => {
                    sum += balance.usdtRate;
                    return sum;
                }, 0);

                currentSymbol = buyPrimarySymbol;
                lastTrade = { symbol: buyPrimarySymbol, price: buyPrice };
                lastCheck = lastTrade;

                console.info("\n\nNew current symbol:", currentSymbol);

                console.info("New balances");
                console.info(`${newPrimarySymbolBalance} ${buyPrimarySymbol}`);
                console.info(`${newSecondarySymbolBalance} ${secondarySymbol}`);
                console.info(`${buyPrimarySymbol} price: ${primarySymbolUsdtPrice}`);
                console.info(`${secondarySymbol} price: ${secondarySymbolUsdtPrice}`);

                console.info(`USDT rate total balance: ${usdtRateTotalBalance}`);

                message += `<b>${buyPrimarySymbol} price</b>: ${parseFloat(
                    buyPrice
                )} ${secondarySymbol}\n`;
                message += `<b>Bought</b>: ${quantity} ${buyPrimarySymbol}\n\n`;
                message += `<b>${buyPrimarySymbol} balance</b>: ${parseFloat(
                    newPrimarySymbolBalance as any
                )}\n`;
                message += `<b>${secondarySymbol} balance</b>: ${parseFloat(
                    newSecondarySymbolBalance as any
                )}\n\n`;
                message += `<b>USDT rate total balance</b>: ${usdtRateTotalBalance.toFixed(
                    2
                )}`;

                console.info("Trade accomplished");

                // await sendImage(chart);
                await this.sendTelegramMessage(message);
            } else {
                // message += "<b>No trade signals</b>";
                // await sendMessage(message);

                lastCheck = { symbol: sellPrimarySymbol, price: sellPrice };
            }
        } catch (error) {
            throw { type: "Heartbeat Loop Error", ...error, errorSrcData: error };
        }
    }

    async getAccountBalances() {
        try {
            const balances = [];
            const accountBalances = await this.getBinanceAccountBalances();

            for (const balance of accountBalances) {
                if (balance.available === 0) continue;

                const { symbol, available } = balance;

                if (symbol === "USDT") {
                    const usdtRate = available;

                    balances.push({ symbol, available, usdtRate });
                } else {
                    const lastPrice = await this.getLastPriceOfTicker(symbol + "USDT");
                    const usdtRate = available * lastPrice;

                    if (isNaN(usdtRate)) continue;

                    balances.push({ symbol, available, usdtRate });
                }
            }

            return balances
                .filter((balance) => balance.available > 0)
                .sort((a, b) => b.usdtRate - a.usdtRate);
        } catch (error) {
            throw { type: "Get Balances Error", ...error, errorSrcData: error };
        }
    }

    // mock for now
    async sendTelegramMessage(message) {
        console.log("message:", message);
    }

    delay(ms) {
        return new Promise((resolve: any) => setTimeout(() => resolve(), ms));
    }

    createTable() {
        const headers = [
          "Count",
          "Date",
          "BTC / USDT price",
          "Token name",
          "24h price change %",
          "Trade",
          "Trade price",
          "Comission",
          "Profit %",
          "Profit total %",
          "Market average",
        ];
      
        execSync(`rm -rf ${filePath}`);
      
        console.log("Report file erased");
      
        const stream = fs.createWriteStream(filePath, fileOptions);
        const csvStream = format({ includeEndRowDelimiter: true });
        csvStream.pipe(stream);
        csvStream.write(headers);
        csvStream.end();
      
        console.log("Report file created:", filePath);
    }

    reportTradeAction({
        date,
        trade,
        symbol,
        price,
        priceChangePercent,
        btcUsdtPrice,
        marketAveragePrice,
      }) {
        const stream = fs.createWriteStream(filePath, fileOptions);
        const csvStream = format({
          headers: false,
          includeEndRowDelimiter: true,
        });
      
        csvStream.pipe(stream);
      
        count++;
      
        const comission = price * comissionPercent;
      
        if (trade === "SELL") {
          const onePercent = lastPrice === undefined ? 0 : lastPrice / 100;
      
          const profitPercent =
            lastPrice !== undefined
              ? (price - lastPrice) / onePercent - comissionPercent
              : -comissionPercent;
      
          profitTotal += profitPercent;
      
          csvStream.write({
            Count: count,
            Date: date.toISOString(),
            "BTC / USDT price": btcUsdtPrice,
            "Token name": symbol,
            "24h price change %": +priceChangePercent.toFixed(4),
            Trade: trade,
            "Trade price": +price.toFixed(4),
            Comission: +comission.toFixed(4),
            "Profit %": +profitPercent.toFixed(4),
            "Profit total %": +profitTotal.toFixed(4),
            "Market average": +marketAveragePrice.toFixed(4),
          });
      
          lastPrice = price;
        } else if (trade === "BUY") {
          profitTotal -= comissionPercent;
          const profitPercent = -comissionPercent;
      
          csvStream.write({
            Count: count,
            Date: date.toISOString(),
            "BTC / USDT price": btcUsdtPrice,
            "Token name": symbol,
            "24h price change %": +priceChangePercent.toFixed(4),
            Trade: trade,
            "Trade price": +price.toFixed(4),
            Comission: +comission.toFixed(4),
            "Profit %": +profitPercent.toFixed(4),
            "Profit total %": +profitTotal.toFixed(4),
            "Market average": +marketAveragePrice.toFixed(4),
          });
      
          lastPrice = price;
        } else if (trade === "PASS") {
          csvStream.write({
            Count: count,
            Date: date.toISOString(),
            "BTC / USDT price": btcUsdtPrice,
            "Token name": "",
            "24h price change %": +(priceChangePercent || 0).toFixed(4),
            Trade: "",
            "Trade price": "",
            Comission: 0,
            "Profit %": 0,
            "Profit total %": +profitTotal.toFixed(4),
            "Market average": +marketAveragePrice.toFixed(4),
          });
        }
      
        csvStream.end();
    }
}
