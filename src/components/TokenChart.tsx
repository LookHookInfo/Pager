"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, Time } from "lightweight-charts";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Indicators {
  sma20?: (number | undefined)[];
  sma50?: (number | undefined)[];
  rsi?: (number | undefined)[];
}

export default function TokenChart({
  candles,
  indicators,
  symbol,
}: {
  candles: Candle[];
  indicators?: Indicators;
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const sma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const [activeIndicator, setActiveIndicator] = useState<"sma" | "rsi" | "none">("sma");

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#ffffff" },
        textColor: "#6b7280",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#f3f4f6" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#d1d5db", width: 1, style: 2 },
        horzLine: { color: "#d1d5db", width: 1, style: 2 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#e5e7eb",
      },
      rightPriceScale: {
        borderColor: "#e5e7eb",
      },
      width: containerRef.current.clientWidth,
      height: 400,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: (Math.floor(new Date(c.time).getTime() / 1000)) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(candleData);
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumeData: HistogramData<Time>[] = candles.map((c) => ({
      time: (Math.floor(new Date(c.time).getTime() / 1000)) as Time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
    }));

    volumeSeries.setData(volumeData);

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles]);

  useEffect(() => {
    if (!chartRef.current || !candles.length || !indicators) return;
    const chart = chartRef.current;

    if (sma20Ref.current) { chart.removeSeries(sma20Ref.current); sma20Ref.current = null; }
    if (sma50Ref.current) { chart.removeSeries(sma50Ref.current); sma50Ref.current = null; }

    if (activeIndicator === "sma") {
      if (indicators.sma20) {
        const sma20Series = chart.addSeries(LineSeries, {
          color: "#3b82f6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const sma20Data = indicators.sma20
          .map((v, i) => v !== undefined ? {
            time: (Math.floor(new Date(candles[i].time).getTime() / 1000)) as Time,
            value: v,
          } : null)
          .filter(Boolean) as { time: Time; value: number }[];
        sma20Series.setData(sma20Data);
        sma20Ref.current = sma20Series;
      }
      if (indicators.sma50) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const sma50Data = indicators.sma50
          .map((v, i) => v !== undefined ? {
            time: (Math.floor(new Date(candles[i].time).getTime() / 1000)) as Time,
            value: v,
          } : null)
          .filter(Boolean) as { time: Time; value: number }[];
        sma50Series.setData(sma50Data);
        sma50Ref.current = sma50Series;
      }
    }
  }, [activeIndicator, indicators, candles]);

  const latestClose = candles[candles.length - 1]?.close;
  const prevClose = candles[candles.length - 2]?.close;
  const isUp = latestClose >= prevClose;
  const latestRsi = indicators?.rsi ? indicators.rsi[indicators.rsi.length - 1] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{symbol} / USD</span>
          {latestClose !== undefined && (
            <span className={`text-sm font-black ${isUp ? "text-green-500" : "text-red-500"}`}>
              ${latestClose < 0.01 ? latestClose.toExponential(2) : latestClose.toFixed(latestClose > 100 ? 2 : 6)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveIndicator("sma")}
            className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-sm transition-all ${activeIndicator === "sma" ? "bg-black text-white" : "text-gray-400 hover:text-black"}`}
          >
            SMA
          </button>
          <button
            onClick={() => setActiveIndicator("none")}
            className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-sm transition-all ${activeIndicator === "none" ? "bg-black text-white" : "text-gray-400 hover:text-black"}`}
          >
            Off
          </button>
        </div>
      </div>

      <div ref={containerRef} className="w-full border border-gray-100 rounded-sm overflow-hidden" />

      {latestRsi !== null && latestRsi !== undefined && (
        <div className="flex items-center gap-4 px-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">
            RSI(14):
          </span>
          <span className={`text-[10px font-black ${latestRsi > 70 ? "text-red-500" : latestRsi < 30 ? "text-green-500" : "text-gray-500"}`}>
            {latestRsi.toFixed(1)}
          </span>
          {latestRsi > 70 && <span className="text-[7px] font-bold uppercase text-red-400">Overbought</span>}
          {latestRsi < 30 && <span className="text-[7px] font-bold uppercase text-green-400">Oversold</span>}
        </div>
      )}

      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-[2px] bg-blue-500 rounded" />
          <span className="text-[7px] font-bold uppercase text-gray-400">SMA 20</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-[2px] bg-amber-500 rounded" />
          <span className="text-[7px] font-bold uppercase text-gray-400">SMA 50</span>
        </div>
      </div>
    </div>
  );
}
