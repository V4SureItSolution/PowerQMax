import { COMPANY_STAMP_BASE64 } from "./invoiceLogos";

/**
 * Shared Document Footer CSS for Invoice, Quotation, Delivery Order, and Purchase Order print pages.
 * Displays centered regular sans-serif "Page X of Y" at the bottom of every printed page.
 * Uses position: fixed and @page margins.
 */
export const DOC_FOOTER_CSS = `
  @page {
    size: A4 portrait;
    margin: 0;
  }

  body {
    position: relative;
    margin: 0;
    padding: 8mm 12mm 14mm 12mm !important;
    box-sizing: border-box;
  }

  /* Document Footer - Fixed at bottom of every printed page */
  .doc-footer {
    position: fixed;
    bottom: 4mm;
    left: 0;
    right: 0;
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
    text-align: center;
    background: transparent;
    padding-top: 4px;
    padding-bottom: 4px;
    z-index: 9999;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .doc-footer-pages {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5px;
    color: #565656 !important;
    line-height: 1.2;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
`;

/**
 * Shared Company Stamp CSS for Invoice, Quotation, Delivery Order, and Purchase Order print pages.
 * Positions the stamp below the heading "For PowerQ Max Engineering Pte Ltd",
 * perfectly centered horizontally and vertically inside the signature area,
 * looking neat, crisp, and professional.
 */
export const COMPANY_STAMP_CSS = `
  .sig-heading-wrap {
    position: relative;
    display: block;
    margin-bottom: 4px;
  }
  .sig-title {
    font-weight: bold;
    font-size: 8.5pt;
    color: #000;
    display: block;
    margin-bottom: 4px;
  }
  .sig-space {
    height: 70px;
    position: relative;
    margin-bottom: 4px;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .sig-block:first-child .sig-title {
    margin-bottom: 3px;
  }
  .sig-block:first-child .sig-space {
    width: 135px;
    max-width: 100%;
    height: 66px;
    margin-bottom: 0;
  }
  .sig-box:first-child .sig-space {
    width: 200px;
    max-width: 100%;
  }
  .sig-block:first-child .sig-legend {
    margin-top: 2px;
  }
  .company-stamp {
    width: 66px;
    height: 66px;
    object-fit: contain;
    z-index: 2;
    mix-blend-mode: multiply;
    pointer-events: none;
    display: block;
    margin: 0 auto;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .sig-line {
    border-bottom: 1.2px solid #000;
    width: 100%;
    margin-bottom: 4px;
    clear: both;
  }
  .sig-legend {
    font-size: 7.5pt;
    color: #666;
  }

  ${DOC_FOOTER_CSS}
`;

/**
 * Generates the bold heading text (e.g. "For PowerQ Max Engineering Pte Ltd").
 */
export const renderCompanyStampHeading = (title = "For PowerQ Max Engineering Pte Ltd") => `
  <div class="sig-title">${title}</div>
`;

/**
 * Generates the centered round company stamp placed below the heading.
 */
export const renderCompanyStamp = () => `
  <img src="${COMPANY_STAMP_BASE64}" alt="PowerQ Max Company Stamp" class="company-stamp" />
`;

/**
 * Shared Document Footer HTML:
 * Centered regular sans-serif "Page X of Y" at the bottom of every printed page.
 */
export const renderDocumentFooterHtml = (currentPage = 1, totalPages = 1) => `
  <div class="doc-footer">
    <div class="doc-footer-pages">Page <span class="page-current">${currentPage}</span> of <span class="page-total">${totalPages}</span></div>
  </div>
`;

/**
 * Standard print script to dynamically compute total pages and initiate print.
 */
export const DOC_PRINT_SCRIPT = `
  <script>
    function initPrintDoc() {
      try {
        var container = document.querySelector('.invoice-container, .po-container, .do-container, .quotation-container') || document.body;
        var pageHeight = 1040;
        var totalPages = Math.max(1, Math.ceil((container.scrollHeight || document.body.scrollHeight) / pageHeight));
        var totalEls = document.querySelectorAll('.page-total');
        for (var i = 0; i < totalEls.length; i++) {
          totalEls[i].textContent = totalPages;
        }
      } catch (e) {}

      try {
        if (document.title && window.parent && window.parent !== window) {
          window.parent.document.title = document.title;
        }
      } catch (e) {}

      setTimeout(function() {
        try {
          window.focus();
        } catch (err) {}
        window.print();
      }, 350);
    }

    if (document.readyState === 'complete') {
      initPrintDoc();
    } else {
      window.onload = initPrintDoc;
    }
  </script>
`;

/**
 * Seamless Document Printer:
 * Prints documents via an invisible iframe or Blob URL.
 * Completely eliminates "about:blank" and default browser header/footer URLs.
 * Sets the document and tab title (e.g. PowerQmax_Invoice, PowerQmax_Quotation, etc.)
 * so that when saving as PDF, the browser defaults to the specific document name instead of generic "PowerQmax".
 */
export const printDocumentHtml = (printContent, documentTitle) => {
  let docTitle = documentTitle;
  if (!docTitle && printContent) {
    const match = printContent.match(/<title>([^<]+)<\/title>/i);
    if (match && match[1]) {
      docTitle = match[1].trim();
    }
  }

  // Update HTML <title> tag if docTitle is explicitly given and differs from HTML
  if (docTitle && printContent) {
    if (/<title>[^<]*<\/title>/i.test(printContent)) {
      printContent = printContent.replace(/<title>[^<]*<\/title>/i, `<title>${docTitle}</title>`);
    }
  }

  // Preserve the original main window title
  const originalTitle = document.title || "PowerQMax";
  let titleRestored = false;
  const restoreTitle = () => {
    if (titleRestored) return;
    titleRestored = true;
    document.title = originalTitle;
    window.removeEventListener('afterprint', restoreTitle);
    const existingFrame = document.getElementById('print-clean-iframe');
    if (existingFrame && existingFrame.contentWindow) {
      try {
        existingFrame.contentWindow.removeEventListener('afterprint', restoreTitle);
      } catch (e) {}
    }
  };

  if (docTitle) {
    document.title = docTitle;
    window.addEventListener('afterprint', restoreTitle);
    // Safety fallback: restore after 60 seconds if afterprint doesn't fire
    setTimeout(restoreTitle, 60000);
  }

  try {
    let printFrame = document.getElementById('print-clean-iframe');
    if (printFrame) {
      printFrame.parentNode.removeChild(printFrame);
    }
    printFrame = document.createElement('iframe');
    printFrame.id = 'print-clean-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.top = '0';
    printFrame.style.left = '0';
    printFrame.style.width = '800px';
    printFrame.style.height = '1000px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    printFrame.style.zIndex = '-9999';
    document.body.appendChild(printFrame);

    if (docTitle && printFrame.contentWindow) {
      try {
        printFrame.contentWindow.addEventListener('afterprint', restoreTitle);
      } catch (e) {}
    }

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(printContent);
    frameDoc.close();

    if (docTitle) {
      try {
        frameDoc.title = docTitle;
      } catch (e) {}
    }
  } catch (err) {
    try {
      const blob = new Blob([printContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const printWin = window.open(blobUrl, '_blank');
      if (printWin && docTitle) {
        try {
          printWin.document.title = docTitle;
        } catch (e) {}
      }
      if (!printWin) {
        alert('Please allow pop-ups to print the document');
      }
    } catch (e) {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(printContent);
        printWin.document.close();
        if (docTitle) {
          try {
            printWin.document.title = docTitle;
          } catch (e) {}
        }
      }
    }
  }
};
