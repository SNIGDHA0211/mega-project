import type { jsPDF } from 'jspdf';

/** PlanetEye Farm-AI logo in public/images (white-friendly background in asset). */
export const PDF_PLANETEYE_LOGO_PATH = `/images/${encodeURIComponent('PlanetEye Farm-AI logo design.png')}`;

export async function loadPublicImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * PDF header: PlanetEye logo (left), one-line colored “Nearlive Crop Monitoring” (centered), tagline, rule.
 * Returns next Y (mm) for body text.
 */
export async function appendPdfBrandedHeader(
  pdf: jsPDF,
  pageWidthMm: number,
  marginMm: number,
  yStartMm: number
): Promise<number> {
  const logoMaxW = 26;
  const logoMaxH = 14;

  const logoData = await loadPublicImageAsDataUrl(PDF_PLANETEYE_LOGO_PATH);
  let bandFromTop = yStartMm;
  if (logoData) {
    try {
      const props = pdf.getImageProperties(logoData);
      const sc = Math.min(logoMaxW / props.width, logoMaxH / props.height);
      const lw = props.width * sc;
      const lh = props.height * sc;
      const fmt: 'PNG' | 'JPEG' = logoData.includes('image/jpeg') || logoData.includes('image/jpg') ? 'JPEG' : 'PNG';
      pdf.addImage(logoData, fmt, marginMm, yStartMm + 0.5, lw, lh);
      bandFromTop = yStartMm + 0.5 + lh;
    } catch {
      /* optional */
    }
  }

  const titleY = yStartMm + 9;
  const parts: Array<{ text: string; rgb: [number, number, number] }> = [
    { text: 'Nearlive ', rgb: [6, 95, 70] },
    { text: 'Crop ', rgb: [16, 185, 129] },
    { text: 'Monitoring', rgb: [52, 211, 153] },
  ];

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  let totalW = 0;
  parts.forEach((p) => {
    totalW += pdf.getTextWidth(p.text);
  });
  let x = (pageWidthMm - totalW) / 2;
  parts.forEach((p) => {
    pdf.setTextColor(...p.rgb);
    pdf.text(p.text, x, titleY);
    x += pdf.getTextWidth(p.text);
  });

  let y = Math.max(bandFromTop + 3.5, titleY + 5.5);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('P R E C I S I O N   I N T E L L I G E N C E', pageWidthMm / 2, y, { align: 'center' });
  y += 6;

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(marginMm, y, pageWidthMm - marginMm, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(51, 65, 85);

  return y + 5;
}
