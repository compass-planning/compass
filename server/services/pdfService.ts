/**
 * pdfService.ts
 * Generates a PDF from an HTML string using puppeteer-core.
 * Keeps a warm browser instance to avoid cold-start overhead.
 */

import puppeteerCore, { Browser } from "puppeteer-core";

let _executablePath: string | null = null;
let _browser: Browser | null = null;

async function getExecutablePath(): Promise<string> {
  if (_executablePath) return _executablePath;
  const systemChromium = process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser";
  const fs = await import("fs");
  if (fs.existsSync(systemChromium)) {
    _executablePath = systemChromium;
    return _executablePath;
  }
  try {
    const chromium = await import("@sparticuz/chromium");
    _executablePath = await chromium.default.executablePath();
    return _executablePath!;
  } catch {
    throw new Error("No Chromium executable found.");
  }
}

async function getBrowser(): Promise<Browser> {
  if (_browser) {
    try {
      // Check if browser is still alive
      await _browser.version();
      return _browser;
    } catch {
      _browser = null;
    }
  }

  const executablePath = await getExecutablePath();
  console.log("[pdfService] launching Chromium at:", executablePath);

  _browser = await puppeteerCore.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--disable-extensions",
      "--disable-web-security",
    ],
  });

  console.log("[pdfService] browser ready");
  return _browser;
}

// Pre-warm the browser on module load
getExecutablePath().then(() => getBrowser()).catch(e => {
  console.error("[pdfService] pre-warm failed:", e.message);
});

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  console.log("[pdfService] generating PDF, HTML size:", html.length);

  try {
    // Inject toolbar-hide CSS directly into HTML
    const htmlReady = html.replace(
      "</head>",
      `<style>.report-toolbar{display:none!important;}body{padding-top:0!important;}</style></head>`
    );

    await page.setContent(htmlReady, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // Wait for layout to settle
    await new Promise(resolve => setTimeout(resolve, 800));

   const footerText = "This report is based on information and assumptions provided by you. It is intended as a guide only and does not constitute legal, tax, or investment advice. Projections are hypothetical and not a guarantee of future results. Please consult your tax advisor before implementing any strategies contained herein.";

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "15mm", bottom: "18mm", left: "10mm", right: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `<span></span>`,
      footerTemplate: `
        <div style="width:100%;font-size:7px;color:#9ca3af;padding:0 10mm;box-sizing:border-box;text-align:center;line-height:1.4;">
          ${footerText}
        </div>`,
    });

    console.log("[pdfService] PDF done, bytes:", pdf.length);
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
