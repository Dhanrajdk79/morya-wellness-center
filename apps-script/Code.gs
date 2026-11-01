// Morya Wellness Center - Google Apps Script (bind to a Google Sheet: Extensions > Apps Script)
const TOKEN = 'CHANGE_THIS_SECRET';           // must match SCRIPT_TOKEN in backend/.env
const IMAGE_FOLDER = 'Morya Product Images';  // auto-created in your Drive
const P_HEAD = ['id','name','sku','mrp','vp','gst','stock','imageUrl','createdAt'];
const B_HEAD = ['billNo','date','customer','phone','discountPct','totalVP','mrpTotal','discountAmt','extraDiscAmt','taxable','gst','grandTotal','itemsJson'];

function sheet_(name, head) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function rows_(sh, head) {
  const v = sh.getDataRange().getValues(); v.shift();
  return v.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ids_(P) { return P.getLastRow() < 2 ? [] : P.getRange(2, 1, P.getLastRow() - 1, 1).getValues().flat(); }

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out_({ ok: false, error: 'Unauthorized' });
    const P = sheet_('Products', P_HEAD), B = sheet_('Bills', B_HEAD);

    if (d.action === 'getProducts') return out_({ ok: true, data: rows_(P, P_HEAD) });
    if (d.action === 'getBills') return out_({ ok: true, data: rows_(B, B_HEAD).reverse() });

    if (d.action === 'addProduct') {
      const p = d.product, id = 'P' + Date.now();
      let img = '';
      if (p.imageBase64) {
        const it = DriveApp.getFoldersByName(IMAGE_FOLDER);
        const folder = it.hasNext() ? it.next() : DriveApp.createFolder(IMAGE_FOLDER);
        const blob = Utilities.newBlob(Utilities.base64Decode(p.imageBase64), p.imageType || 'image/jpeg', id + '.jpg');
        const f = folder.createFile(blob);
        f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        img = 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w500';
      }
      P.appendRow([id, p.name, p.sku, +p.mrp, +p.vp, +p.gst, +p.stock, img, new Date()]);
      return out_({ ok: true, id });
    }

    if (d.action === 'addStock') {
      const r = ids_(P).indexOf(d.id);
      if (r < 0) return out_({ ok: false, error: 'Product not found' });
      const cell = P.getRange(r + 2, 7);
      cell.setValue(Number(cell.getValue()) + Number(d.qty));
      return out_({ ok: true });
    }

    if (d.action === 'saveBill') {
      const b = d.bill, ids = ids_(P);
      for (const it of b.items) {
        const r = ids.indexOf(it.id);
        if (r < 0) return out_({ ok: false, error: 'Product missing: ' + it.name });
        if (Number(P.getRange(r + 2, 7).getValue()) < it.qty) return out_({ ok: false, error: 'Not enough stock: ' + it.name });
      }
      b.items.forEach(it => { const c = P.getRange(ids.indexOf(it.id) + 2, 7); c.setValue(Number(c.getValue()) - it.qty); });
      const billNo = 'MWC-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd') + '-' + String(B.getLastRow()).padStart(4, '0');
      B.appendRow([billNo, new Date(), b.customer, b.phone, b.discountPct, b.totalVP, b.mrpTotal, b.discountAmt, b.extraDiscAmt, b.taxable, b.gst, b.grandTotal, JSON.stringify(b.items)]);
      return out_({ ok: true, billNo });
    }
    return out_({ ok: false, error: 'Unknown action' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
  finally { lock.releaseLock(); }
}
// Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone. Copy the /exec URL.
