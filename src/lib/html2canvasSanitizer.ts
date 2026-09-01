import { jsPDF } from 'jspdf';

export function sanitizeClonedDocForHtml2Canvas(
  clonedDoc: Document,
  defaultBg = '#ffffff',
  defaultColor = '#1e293b'
) {
  try {
    const canvasCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

    const convertColor = (colorStr: string): string => {
      if (!colorStr) return colorStr;
      if (!colorStr.includes('oklab') && !colorStr.includes('oklch')) {
        return colorStr;
      }
      if (canvasCtx) {
        try {
          canvasCtx.fillStyle = '#000000';
          canvasCtx.fillStyle = colorStr;
          const resolved = canvasCtx.fillStyle;
          if (resolved && resolved !== '#000000') {
            return resolved;
          }
        } catch (e) {}
      }
      return colorStr
        .replace(/oklch\([^)]+\)/gi, defaultColor)
        .replace(/oklab\([^)]+\)/gi, defaultColor);
    };

    // 1. Process all <style> tags without deleting CSS rules or selectors
    const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent && (styleTag.textContent.includes('oklab') || styleTag.textContent.includes('oklch'))) {
        styleTag.textContent = styleTag.textContent
          .replace(/oklch\([^)]+\)/gi, (m) => convertColor(m))
          .replace(/oklab\([^)]+\)/gi, (m) => convertColor(m));
      }
    });

    // 2. Inject print-color-adjust and convert colors on elements
    const allEls = Array.from(clonedDoc.querySelectorAll('*')) as HTMLElement[];
    allEls.forEach((el) => {
      el.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
      el.style.setProperty('print-color-adjust', 'exact', 'important');

      const inlineStyle = el.getAttribute('style');
      if (inlineStyle && (inlineStyle.includes('oklab') || inlineStyle.includes('oklch'))) {
        el.setAttribute(
          'style',
          inlineStyle
            .replace(/oklch\([^)]+\)/gi, (m) => convertColor(m))
            .replace(/oklab\([^)]+\)/gi, (m) => convertColor(m))
        );
      }

      try {
        const computed = window.getComputedStyle(el);
        if (computed) {
          if (computed.backgroundColor && (computed.backgroundColor.includes('oklab') || computed.backgroundColor.includes('oklch'))) {
            el.style.backgroundColor = convertColor(computed.backgroundColor);
          }
          if (computed.color && (computed.color.includes('oklab') || computed.color.includes('oklch'))) {
            el.style.color = convertColor(computed.color);
          }
          if (computed.borderColor && (computed.borderColor.includes('oklab') || computed.borderColor.includes('oklch'))) {
            el.style.borderColor = convertColor(computed.borderColor);
          }
        }
      } catch (e) {}
    });
  } catch (err) {
    console.warn("Sanitização do clone finalizada com aviso:", err);
  }
}

export function exportCanvasToA4PDF(canvas: HTMLCanvasElement, fileName: string) {
  const imgData = canvas.toDataURL('image/png');
  const isLandscape = canvas.width > canvas.height;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;

  let pdfImgHeight = (canvas.height * printableWidth) / canvas.width;
  let renderWidth = printableWidth;

  // Ajuste inteligente: se ultrapassar por até 15%, auto-escala para caber perfeitamente em 1 página
  if (pdfImgHeight > printableHeight && pdfImgHeight <= printableHeight * 1.15) {
    const scaleRatio = printableHeight / pdfImgHeight;
    renderWidth = printableWidth * scaleRatio;
    pdfImgHeight = printableHeight;
    const xOffset = margin + (printableWidth - renderWidth) / 2;
    pdf.addImage(imgData, 'PNG', xOffset, margin, renderWidth, pdfImgHeight);
  } else if (pdfImgHeight <= printableHeight) {
    pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, pdfImgHeight);
  } else {
    let heightLeft = pdfImgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, printableWidth, pdfImgHeight);
    heightLeft -= printableHeight;

    while (heightLeft > 8) {
      position = margin - (pdfImgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, printableWidth, pdfImgHeight);
      heightLeft -= printableHeight;
    }
  }

  pdf.save(fileName);
}

