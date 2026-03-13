import { jsPDF } from 'jspdf';

export interface DashboardIndicesPdfItem {
  index_name: string;
  period_date: string;
  value: number;
}

export interface DashboardIndicesPdfOptions {
  district: string;
  subdistrict: string;
  village: string;
  stored: DashboardIndicesPdfItem[];
}

const INDEX_ORDER = ['evi', 'bsi', 'gndvi', 'lst', 'ndbi', 'ndmi', 'ndre', 'ndvi', 'evi2'] as const;

const CARD_COLORS: Record<string, [number, number, number]> = {
  evi: [34, 197, 94],      // green
  bsi: [245, 158, 11],     // orange
  gndvi: [6, 182, 212],    // cyan
  lst: [239, 68, 68],      // red
  ndbi: [139, 92, 246],    // purple
  ndmi: [236, 72, 153],    // pink
  ndre: [20, 184, 166],    // teal
  ndvi: [59, 130, 246],    // blue
  evi2: [132, 204, 22],    // lime
};

// A4 landscape in mm
const A4_LANDSCAPE_WIDTH = 297;
const A4_LANDSCAPE_HEIGHT = 210;

function addPageA4Landscape(pdf: jsPDF): void {
  pdf.addPage('a4', 'l');
}

function formatDateLabel(periodDate: string): string {
  try {
    const d = new Date(periodDate);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = String(d.getFullYear()).slice(-2);
    return `${month} '${year}`;
  } catch {
    return periodDate.slice(0, 7);
  }
}

function formatYLabel(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.0001 && value !== 0)) return value.toExponential(1);
  if (Math.abs(value) < 1) return value.toFixed(3);
  return value.toFixed(2);
}

/**
 * Draw one multi-year line chart in the given rectangle (x, y, w, h in mm).
 * X-axis: months, multiple colored lines: one per year with legend.
 */
function drawChart(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  cardName: string,
  points: Array<{ period_date: string; value: number }>,
  color: [number, number, number]
): void {
  const pad = 2;
  const titleH = 6;
  const subtitleH = 4;
  const yAxisW = 14;
  const xAxisLabelH = 5;
  const legendH = 6;
  const xAxisH = xAxisLabelH + legendH; // space for x-axis labels + legend below (no overlap)
  const plotLeft = x + pad + yAxisW;
  const plotRight = x + w - pad;
  const plotTop = y + pad + titleH + subtitleH;
  const plotBottom = y + h - pad - xAxisH;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // Card background
  pdf.setDrawColor(80, 80, 80);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, w, h);

  // Title (index name)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...color);
  pdf.text(cardName.toUpperCase(), x + pad, y + pad + 4);

  // Subtitle and latest value
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`${points.length} points`, x + pad, y + pad + titleH + 3);
  if (points.length > 0) {
    const last = points[points.length - 1];
    const valStr = typeof last.value === 'number' && (Math.abs(last.value) >= 1000 || (Math.abs(last.value) < 0.0001 && last.value !== 0))
      ? last.value.toExponential(2)
      : String(last.value);
    pdf.text(valStr, plotRight - 1, y + pad + 4, { align: 'right' });
  }

  if (points.length < 1) {
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('No data', plotLeft + plotW / 2 - 5, plotTop + plotH / 2 - 2);
    return;
  }

  // Fixed 12 months (Jan–Dec) so each year draws one continuous line across the chart
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthMap: Record<string, { month: string; monthIndex: number; values: Record<string, number> }> = {};
  const yearsSet = new Set<number>();

  points.forEach((p) => {
    const d = new Date(p.period_date);
    if (isNaN(d.getTime())) return;
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const monthLabel = d.toLocaleString('en-US', { month: 'short' });
    const key = `${monthIndex}-${monthLabel}`;
    yearsSet.add(year);
    if (!monthMap[key]) {
      monthMap[key] = { month: monthLabel, monthIndex, values: {} };
    }
    monthMap[key].values[String(year)] = p.value;
  });

  const years = Array.from(yearsSet).sort((a, b) => a - b).map((y) => String(y));
  const months = MONTH_LABELS.map((month, monthIndex) => {
    const key = `${monthIndex}-${month}`;
    const existing = monthMap[key];
    return {
      month,
      monthIndex,
      values: existing ? existing.values : {},
    };
  });

  if (!months.length || !years.length) {
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('No data', plotLeft + plotW / 2 - 5, plotTop + plotH / 2 - 2);
    return;
  }

  const allValues: number[] = [];
  months.forEach((m) => {
    years.forEach((yKey) => {
      const v = m.values[yKey];
      if (typeof v === 'number' && !isNaN(v)) allValues.push(v);
    });
  });

  if (!allValues.length) {
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('No data', plotLeft + plotW / 2 - 5, plotTop + plotH / 2 - 2);
    return;
  }

  const values = allValues;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Y-axis tick labels (bold numbers)
  const yTickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i < yTickCount; i++) {
    const t = i / (yTickCount - 1);
    yTicks.push(minVal + t * range);
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6);
  pdf.setTextColor(60, 60, 60);
  yTicks.forEach((val, i) => {
    const py = plotBottom - (i / (yTickCount - 1)) * plotH;
    pdf.text(formatYLabel(val), plotLeft - 1, py + 1, { align: 'right' });
  });

  // X-axis tick labels (all 12 months) – in dedicated zone below plot
  const xAxisY = plotBottom + 3;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.setTextColor(70, 70, 70);
  const mCount = Math.max(1, months.length - 1);
  months.forEach((m, idx) => {
    const px = plotLeft + (idx / mCount) * plotW;
    pdf.text(m.month, px, xAxisY, { align: 'center' });
  });

  // Grid lines (light)
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.1);
  for (let i = 0; i < yTickCount; i++) {
    const py = plotBottom - (i / (yTickCount - 1)) * plotH;
    pdf.line(plotLeft, py, plotRight, py);
  }
  for (let i = 0; i <= 4; i++) {
    const px = plotLeft + (i / 4) * plotW;
    pdf.line(px, plotTop, px, plotBottom);
  }

  const getX = (i: number) => {
    const denom = Math.max(1, months.length - 1);
    return plotLeft + (i / denom) * plotW;
  };
  const getY = (v: number) => plotBottom - ((v - minVal) / range) * plotH;

  // Palette for years (10 colors)
  const YEAR_COLORS: Array<[number, number, number]> = [
    [34, 197, 94],
    [59, 130, 246],
    [249, 115, 22],
    [168, 85, 247],
    [225, 29, 72],
    [16, 185, 129],
    [250, 204, 21],
    [99, 102, 241],
    [20, 184, 166],
    [239, 68, 68],
  ];

  // Draw one continuous line per year (connect points across months)
  years.forEach((yearKey, yearIdx) => {
    const rgb = YEAR_COLORS[yearIdx % YEAR_COLORS.length];
    pdf.setDrawColor(...rgb);
    pdf.setLineWidth(0.5);
    let prev: { x: number; y: number } | null = null;
    months.forEach((m, idx) => {
      const v = m.values[yearKey];
      if (typeof v !== 'number' || isNaN(v)) {
        prev = null;
        return;
      }
      const xPos = getX(idx);
      const yPos = getY(v);
      if (prev) {
        pdf.line(prev.x, prev.y, xPos, yPos);
      }
      prev = { x: xPos, y: yPos };
    });
  });

  // Legend: single row below x-axis, evenly spaced so labels don’t overlap or truncate
  const legendY = plotBottom + xAxisLabelH + 1;
  const nYears = years.length;
  const itemWidth = nYears > 0 ? plotW / nYears : plotW;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(60, 60, 60);
  years.forEach((yearKey, idx) => {
    const rgb = YEAR_COLORS[idx % YEAR_COLORS.length];
    const lx = plotLeft + idx * itemWidth + 2;
    const ly = legendY + 2;
    const swatchW = 3;
    const swatchH = 1.5;
    pdf.setDrawColor(...rgb);
    pdf.setFillColor(...rgb);
    pdf.rect(lx, ly - swatchH, swatchW, swatchH, 'FD');
    pdf.text(yearKey, lx + swatchW + 1.5, ly - 0.3);
  });
}

function addWrappedText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  pageHeight: number,
  lineHeight: number = 5,
  pageMargin: number = 10
): number {
  const lines = pdf.splitTextToSize(text, Math.max(maxWidth - 2, 10));
  lines.forEach((line: string) => {
    if (y > pageHeight - pageMargin - lineHeight) {
      addPageA4Landscape(pdf);
      y = pageMargin;
    }
    pdf.text(line, x, y);
    y += lineHeight;
  });
  return y;
}

/**
 * Generates a PDF from dashboard indices data with a 3x3 grid of line charts (x-axis: dates, y-axis: values).
 * All pages A4 landscape.
 */
export function generateDashboardIndicesPdf(options: DashboardIndicesPdfOptions, filename: string): void {
  const { district, subdistrict, village, stored } = options;
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = A4_LANDSCAPE_WIDTH;
  const pageHeight = A4_LANDSCAPE_HEIGHT;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const pageMargin = 12;
  let yPos = margin;

  // Title: green, centered
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 128, 0);
  pdf.text('Nearlive crop Monitoring', pageWidth / 2, yPos, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  yPos += 10;

  // Location
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  const locParts: string[] = [];
  if (district) locParts.push(`District: ${district}`);
  if (subdistrict) locParts.push(`Subdistrict: ${subdistrict}`);
  if (village) locParts.push(`Village: ${village}`);
  if (locParts.length) {
    yPos = addWrappedText(pdf, locParts.join(', '), margin, yPos, contentWidth, pageHeight, 5, pageMargin);
    yPos += 6;
  }

  // Group by index
  const byIndex: Record<string, Array<{ period_date: string; value: number }>> = {};
  INDEX_ORDER.forEach((name) => { byIndex[name] = []; });
  stored.forEach((item) => {
    const key = String(item.index_name || '').toLowerCase();
    if (byIndex[key]) {
      byIndex[key].push({ period_date: item.period_date, value: item.value });
    }
  });
  INDEX_ORDER.forEach((name) => {
    byIndex[name].sort((a, b) => (a.period_date || '').localeCompare(b.period_date || ''));
  });

  // 3x3 grid of charts on one page (below header)
  const gridTop = yPos;
  const gridH = pageHeight - gridTop - pageMargin;
  const cardW = contentWidth / 3;
  const cardH = gridH / 3;
  const gap = 2;

  INDEX_ORDER.forEach((indexName, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * (cardW + gap);
    const y = gridTop + row * (cardH + gap);
    const points = byIndex[indexName] || [];
    const color = CARD_COLORS[indexName] ?? [100, 100, 100];
    drawChart(pdf, x, y, cardW, cardH, indexName, points, color);
  });

  pdf.save(filename);
}
