import { COMPANY_STAMP_BASE64 } from "./invoiceLogos";

/**
 * Shared Document Footer CSS for Invoice, Quotation, Delivery Order, and Purchase Order print pages.
 * Displays centered regular sans-serif "Page X of Y" at the bottom of every printed page.
 * Uses position: fixed and @page margins.
 */
export const DOC_FOOTER_CSS = `
  @page {
    size: A4 portrait;
    margin: 8mm 12mm 12mm 12mm;
  }

  body {
    position: relative;
    padding-bottom: 30px !important;
  }

  /* Document Footer - Fixed at bottom of every printed page */
  .doc-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
    background: transparent;
    padding-top: 4px;
    padding-bottom: 6px;
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

      setTimeout(function() {
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
