import React, { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol?: string; // Default: 'NSEIX:NIFTY1!'
  interval?: string; // e.g., '1m', '5m', '15m', '1H', '1D'
  height?: string | number;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol = 'NSEIX:NIFTY1!',
  interval = '15m',
  height = '100%'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    // Map timeframes to TradingView interval string
    let tvInterval = '15';
    const cleanTf = interval.trim().toLowerCase();
    if (cleanTf === '1m' || cleanTf === '1') tvInterval = '1';
    else if (cleanTf === '2m' || cleanTf === '2') tvInterval = '2';
    else if (cleanTf === '3m' || cleanTf === '3') tvInterval = '3';
    else if (cleanTf === '5m' || cleanTf === '5') tvInterval = '5';
    else if (cleanTf === '10m' || cleanTf === '10') tvInterval = '10';
    else if (cleanTf === '15m' || cleanTf === '15') tvInterval = '15';
    else if (cleanTf === '30m' || cleanTf === '30') tvInterval = '30';
    else if (cleanTf === '1h' || cleanTf === '60') tvInterval = '60';
    else if (cleanTf === '2h' || cleanTf === '120') tvInterval = '120';
    else if (cleanTf === '4h' || cleanTf === '240') tvInterval = '240';
    else if (cleanTf === '1d' || cleanTf === 'd') tvInterval = 'D';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: tvInterval,
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'in',
      backgroundColor: '#000000',
      gridColor: '#141414',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com'
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol, interval]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundColor: '#000000',
        overflow: 'hidden'
      }}
    />
  );
};
