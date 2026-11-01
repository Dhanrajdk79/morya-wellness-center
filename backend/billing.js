// Herbalife-style billing. Edit TIERS to match your current Herbalife India discount structure.
const TIERS = [ // accumulated monthly VP -> discount % off MRP
  { minVP: 0, pct: 25 },
  { minVP: 500, pct: 35 },
  { minVP: 1000, pct: 42 },
  { minVP: 2000, pct: 50 },
];
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const tierFor = vp => [...TIERS].reverse().find(t => vp >= t.minVP).pct;

// items: [{mrp, vp, gst, qty}]; prevVP = VP already bought this month; extraPct = manual extra discount %
function calcBill(items, prevVP = 0, extraPct = 0) {
  const billVP = items.reduce((s, i) => s + i.vp * i.qty, 0);
  const discountPct = tierFor(prevVP + billVP);
  let mrpTotal = 0, net = 0, gst = 0, taxable = 0;
  items.forEach(i => {
    const mrp = i.mrp * i.qty;
    const n = mrp * (1 - discountPct / 100) * (1 - extraPct / 100);
    const tax = n * i.gst / (100 + i.gst);          // MRP is GST-inclusive
    mrpTotal += mrp; net += n; gst += tax; taxable += n - tax;
  });
  return { totalVP: r2(billVP), discountPct, mrpTotal: r2(mrpTotal),
    discountAmt: r2(mrpTotal * discountPct / 100),
    extraDiscAmt: r2(mrpTotal * (1 - discountPct / 100) * extraPct / 100),
    taxable: r2(taxable), gst: r2(gst), grandTotal: Math.round(net) };
}
module.exports = { calcBill, TIERS };
