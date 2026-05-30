import { chromium } from 'playwright';
const SRC = '/Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective/manual/ots-admin-manual.html';
const OUT = '/Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective/manual/OTS探偵社_運用編集マニュアル.pdf';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://'+SRC, { waitUntil:'networkidle' });
await p.waitForTimeout(1500);
await p.emulateMedia({ media:'print' });
await p.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  margin: { top:'14mm', bottom:'15mm', left:'17mm', right:'17mm' },
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-size:8px;color:#888;padding:0 17mm;display:flex;justify-content:space-between;"><span>株式会社OTS探偵社 運用・編集マニュアル</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
});
await b.close();
console.log('PDF written:', OUT);
