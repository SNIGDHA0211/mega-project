import html2canvas from 'html2canvas';

export type PdfCaptureOptions = {
  /** Nine-card indices grid — stabilize CSS grid + Recharts for rasterization */
  indicesGrid?: boolean;
};

/**
 * After clone, force the dashboard grid to a predictable 3-column layout so Recharts
 * does not overlap (Tailwind breakpoints + wrong windowWidth break ResponsiveContainer).
 */
function fixIndicesGridClone(clonedDoc: Document, rootId: string): void {
  const root = clonedDoc.getElementById(rootId);
  if (!root) return;

  root.style.backgroundColor = '#ffffff';
  root.style.padding = '16px';
  root.style.boxSizing = 'border-box';
  root.style.width = '100%';
  root.style.maxWidth = '1400px';
  root.style.marginLeft = 'auto';
  root.style.marginRight = 'auto';
  root.style.overflow = 'hidden';

  const grids: HTMLElement[] = root.matches('.grid')
    ? [root as HTMLElement]
    : Array.from(root.querySelectorAll(':scope .grid')) as HTMLElement[];
  grids.forEach((grid) => {
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    grid.style.gap = '22px';
    grid.style.width = '100%';
    grid.style.maxWidth = '100%';
    grid.style.alignItems = 'stretch';
  });

  grids.forEach((grid) => {
    grid.querySelectorAll(':scope > div').forEach((cell) => {
      if (cell instanceof HTMLElement) {
        cell.style.minWidth = '0';
        cell.style.maxWidth = '100%';
        cell.style.width = '100%';
        cell.style.overflow = 'hidden';
        cell.style.boxSizing = 'border-box';
        cell.style.isolation = 'isolate';
        cell.style.position = 'relative';
      }
    });
  });

  root.querySelectorAll('.recharts-responsive-container').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.width = '100%';
      el.style.maxWidth = '100%';
      el.style.minHeight = '180px';
    }
  });
  root.querySelectorAll('.recharts-wrapper').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.overflow = 'hidden';
      el.style.maxWidth = '100%';
    }
  });

  root.querySelectorAll('.recharts-legend-wrapper').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.maxWidth = '100%';
      el.style.width = '100%';
      el.style.height = 'auto';
      el.style.overflow = 'visible';
      el.style.paddingTop = '8px';
    }
  });
  root.querySelectorAll('.recharts-default-legend').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.display = 'flex';
      el.style.flexWrap = 'wrap';
      el.style.justifyContent = 'center';
      el.style.alignItems = 'center';
      el.style.gap = '6px 14px';
      el.style.rowGap = '8px';
      el.style.maxWidth = '100%';
      el.style.padding = '4px 2px 0';
    }
  });
  root.querySelectorAll('.recharts-legend-item').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.marginRight = '0';
      el.style.display = 'inline-flex';
      el.style.alignItems = 'center';
    }
  });
  root.querySelectorAll('.recharts-legend-item-text').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.fontSize = '11px';
      el.style.whiteSpace = 'nowrap';
      el.style.lineHeight = '1.2';
      el.style.color = '#374151';
    }
  });
  root.querySelectorAll('.recharts-surface').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.overflow = 'visible';
      el.style.maxWidth = '100%';
    }
  });
}

/**
 * Rasterize a DOM subtree for PDF: white canvas, CORS-safe.
 * Do not set windowWidth/windowHeight — that causes Recharts overlap during capture.
 */
export async function captureElementForPdf(
  element: HTMLElement,
  options: PdfCaptureOptions = {}
): Promise<HTMLCanvasElement> {
  const { indicesGrid = false } = options;
  const id = element.id;

  return html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    allowTaint: false,
    imageTimeout: 20000,
    foreignObjectRendering: false,
    onclone: (clonedDoc) => {
      const de = clonedDoc.documentElement;
      if (de) {
        de.style.background = '#ffffff';
      }
      if (clonedDoc.body) {
        clonedDoc.body.style.background = '#ffffff';
      }

      if (
        indicesGrid &&
        (id === 'indices/retrieve-aggregated-cards' ||
          id.startsWith('indices/retrieve-aggregated-chunk-'))
      ) {
        fixIndicesGridClone(clonedDoc, id);
      } else if (id) {
        const node = clonedDoc.getElementById(id);
        if (node instanceof HTMLElement) {
          node.style.backgroundColor = '#ffffff';
          node.style.padding = '8px';
          node.style.boxSizing = 'border-box';
        }
      }
    },
  });
}
