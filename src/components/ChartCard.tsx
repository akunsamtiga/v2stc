'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDarkMode } from '@/lib/DarkModeContext';

interface ChartCardProps {
  assetSymbol?: string;
  height?: number;
}

interface PricePoint {
  time: number;
  price: number;
  volume?: number;
}

// Generate realistic price movement
const generateRealisticPrice = (prevPrice: number, volatility: number = 0.0003) => {
  const drift = (Math.random() - 0.48) * volatility;
  const shock = (Math.random() - 0.5) * volatility * 2;
  const change = prevPrice * (drift + shock);
  return prevPrice + change;
};

export const ChartCard: React.FC<ChartCardProps> = ({
  assetSymbol,
  height = 400,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const animationRef = useRef<number>(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPriceRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);
  const { isDarkMode } = useDarkMode();

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Initialize data ONLY ONCE on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const basePrice = 45000 + Math.random() * 5000;
    const initialData: PricePoint[] = [];
    const now = Date.now();
    
    let price = basePrice;
    for (let i = 60; i >= 0; i--) {
      price = generateRealisticPrice(price, 0.0005);
      initialData.push({
        time: now - i * 2000,
        price: price,
        volume: Math.random() * 100 + 50,
      });
    }
    
    setData(initialData);
    setCurrentPrice(price);
    lastPriceRef.current = price;
  }, []);

  // Live data update
  useEffect(() => {
    if (data.length === 0) return;

    updateIntervalRef.current = setInterval(() => {
      setData(prevData => {
        const lastPoint = prevData[prevData.length - 1];
        const newPrice = generateRealisticPrice(lastPoint.price, 0.0003);
        
        const newPoint: PricePoint = {
          time: Date.now(),
          price: newPrice,
          volume: Math.random() * 100 + 50,
        };

        const newData = [...prevData, newPoint];
        if (newData.length > 100) {
          newData.shift();
        }

        setCurrentPrice(newPrice);
        const change = ((newPrice - lastPriceRef.current) / lastPriceRef.current) * 100;
        setPriceChange(change);

        return newData;
      });
    }, 1000);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [data.length]);

  // Draw chart with responsive settings
  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Clear canvas
    const bgColor = isDarkMode ? '#1A1A1E' : '#F8F9FA';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Responsive settings based on device
    let PADDING, fontSize, priceSteps, timeSteps, showPriceLabel, lineWidth, pointSize;
    
    if (deviceType === 'mobile') {
      PADDING = { left: 20, right: 10, top: 10, bottom: 10 };
      fontSize = 7;
      priceSteps = 3;
      timeSteps = 2;
      showPriceLabel = false;
      lineWidth = 1.5;
      pointSize = 3;
    } else if (deviceType === 'tablet') {
      PADDING = { left: 50, right: 20, top: 20, bottom: 35 };
      fontSize = 8;
      priceSteps = 3;
      timeSteps = 3;
      showPriceLabel = false;
      lineWidth = 2;
      pointSize = 4;
    } else {
      PADDING = { left: 70, right: 30, top: 25, bottom: 40 };
      fontSize = 9;
      priceSteps = 4;
      timeSteps = 5;
      showPriceLabel = true;
      lineWidth = 2.5;
      pointSize = 5;
    }

    const chartWidth = width - PADDING.left - PADDING.right;
    const chartHeight = height - PADDING.top - PADDING.bottom;

    if (chartWidth <= 0 || chartHeight <= 0) return;

    // Find min/max for scaling
    const visibleData = data.slice(-60);
    const prices = visibleData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const paddedMin = minPrice - priceRange * 0.15;
    const paddedMax = maxPrice + priceRange * 0.15;
    const paddedRange = paddedMax - paddedMin;

    // Helper functions
    const getX = (index: number) => {
      return PADDING.left + (index / (visibleData.length - 1)) * chartWidth;
    };

    const getY = (price: number) => {
      const ratio = (price - paddedMin) / paddedRange;
      return PADDING.top + chartHeight - ratio * chartHeight;
    };

    // Draw grid lines with labels
    ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.07)';
    ctx.lineWidth = 0.5;
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(60, 60, 67, 0.55)';
    
    // Horizontal grid lines (price levels)
    for (let i = 0; i <= priceSteps; i++) {
      const price = paddedMin + (paddedRange / priceSteps) * i;
      const y = PADDING.top + chartHeight - (chartHeight / priceSteps) * i;
      
      // Grid line
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(width - PADDING.right, y);
      ctx.stroke();
      
      // Price label
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const labelOffset = deviceType === 'mobile' ? 5 : 8;
      const priceText = deviceType === 'mobile' ? `${(price/1000).toFixed(0)}k` : `$${price.toFixed(0)}`;
      ctx.fillText(priceText, PADDING.left - labelOffset, y);
    }

    // Vertical grid lines (time)
    for (let i = 0; i <= timeSteps; i++) {
      const x = PADDING.left + (chartWidth / timeSteps) * i;
      
      // Grid line
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, height - PADDING.bottom);
      ctx.stroke();
      
      // Time label - skip on mobile to reduce clutter
      if (deviceType !== 'mobile' && i < visibleData.length) {
        const dataIndex = Math.floor((i / timeSteps) * (visibleData.length - 1));
        const point = visibleData[dataIndex];
        const date = new Date(point.time);
        const timeStr = date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(timeStr, x, height - PADDING.bottom + 5);
      }
    }

    // Create gradient for area fill
    const gradient = ctx.createLinearGradient(0, PADDING.top, 0, height - PADDING.bottom);
    const isPositive = priceChange >= 0;
    
    if (isPositive) {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
      gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.15)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
      gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.15)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(getX(0), height - PADDING.bottom);
    ctx.lineTo(getX(0), getY(visibleData[0].price));

    for (let i = 0; i < visibleData.length - 1; i++) {
      const x0 = getX(i);
      const y0 = getY(visibleData[i].price);
      const x1 = getX(i + 1);
      const y1 = getY(visibleData[i + 1].price);
      
      const cpX = (x0 + x1) / 2;
      ctx.quadraticCurveTo(cpX, y0, x1, y1);
    }

    ctx.lineTo(getX(visibleData.length - 1), height - PADDING.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw main line
    ctx.shadowColor = isPositive ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
    ctx.shadowBlur = deviceType === 'mobile' ? 3 : 6;
    ctx.strokeStyle = isPositive ? '#22c55e' : '#ef4444';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(visibleData[0].price));

    for (let i = 0; i < visibleData.length - 1; i++) {
      const x0 = getX(i);
      const y0 = getY(visibleData[i].price);
      const x1 = getX(i + 1);
      const y1 = getY(visibleData[i + 1].price);
      
      const cpX = (x0 + x1) / 2;
      ctx.quadraticCurveTo(cpX, y0, x1, y1);
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw current price point
    const lastIndex = visibleData.length - 1;
    const lastX = getX(lastIndex);
    const lastY = getY(visibleData[lastIndex].price);

    // Outer pulse
    const pulseSize = pointSize + 2;
    ctx.beginPath();
    ctx.arc(lastX, lastY, pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = isPositive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    ctx.fill();

    // Inner circle
    ctx.beginPath();
    ctx.arc(lastX, lastY, pointSize, 0, Math.PI * 2);
    ctx.fillStyle = isPositive ? '#22c55e' : '#ef4444';
    ctx.fill();

    // Center dot
    ctx.beginPath();
    ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Draw current price label (desktop only)
    if (showPriceLabel) {
      const priceText = `$${currentPrice.toFixed(2)}`;
      ctx.font = `bold 11px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const textMetrics = ctx.measureText(priceText);
      const labelPadding = 10;
      
      let labelX = lastX + 12;
      const labelWidth = textMetrics.width + labelPadding;
      
      if (labelX + labelWidth > width - PADDING.right - 5) {
        labelX = lastX - labelWidth - 12;
        ctx.textAlign = 'right';
      }
      
      const labelY = lastY;
      
      // Background
      ctx.fillStyle = isPositive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = isPositive ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const rectX = ctx.textAlign === 'left' ? labelX - labelPadding / 2 : labelX - labelWidth + labelPadding / 2;
      
      ctx.roundRect(rectX, labelY - 10, labelWidth, 20, 4);
      ctx.fill();
      ctx.stroke();
      
      // Price text
      ctx.fillStyle = isPositive ? '#22c55e' : '#ef4444';
      if (ctx.textAlign === 'right') {
        ctx.fillText(priceText, labelX - labelPadding / 2, labelY);
      } else {
        ctx.fillText(priceText, labelX, labelY);
      }
    }

    // Draw crosshair line
    ctx.strokeStyle = isPositive
      ? isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.35)'
      : isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, lastY);
    ctx.lineTo(width - PADDING.right, lastY);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Animation loop
  useEffect(() => {
    if (data.length === 0) return;

    const animate = () => {
      drawChart();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentPrice, priceChange, deviceType, isDarkMode]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = rect.width;
      const displayHeight = rect.height || (deviceType === 'mobile' ? 100 : deviceType === 'tablet' ? 300 : height);

      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      if (data.length > 0) drawChart();
    };

    const timeoutId = setTimeout(updateSize, 100);
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, data.length, deviceType, isDarkMode]);

  const responsiveHeight = deviceType === 'mobile' ? 100 : deviceType === 'tablet' ? 300 : height;

  const wrapperBg = isDarkMode ? '#1A1A1E' : '#F8F9FA';

  return (
    <div
      style={{ background: wrapperBg, borderRadius: 12, overflow: 'hidden', width: '100%', height: '100%', minHeight: responsiveHeight, border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)', transition: 'background 0.3s, border-color 0.3s' }}
    >
      <div
        ref={containerRef}
        style={{ background: wrapperBg, width: '100%', height: '100%', minHeight: responsiveHeight }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: 'block', touchAction: 'none', maxWidth: '100%' }}
        />
      </div>
    </div>
  );
};