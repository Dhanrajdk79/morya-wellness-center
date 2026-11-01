require('dotenv').config();
const express = require('express'), cors = require('cors'), path = require('path');
const { calcBill, TIERS } = require('./billing');
const app = express();
app.use(cors()); app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

async function script(action, payload = {}) {
  const res = await fetch(process.env.SCRIPT_URL, { method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: process.env.SCRIPT_TOKEN, action, ...payload }) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Sheet error');
  return j;
}
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));

app.get('/api/tiers', (_, res) => res.json(TIERS));
app.get('/api/products', wrap(async (_, res) => res.json((await script('getProducts')).data)));
app.get('/api/bills', wrap(async (_, res) => res.json((await script('getBills')).data)));
app.post('/api/products', wrap(async (req, res) => {
  const p = req.body;
  if (!p.name || !(p.mrp > 0)) throw new Error('Name and MRP are required');
  res.json(await script('addProduct', { product: p }));
}));
app.post('/api/products/:id/stock', wrap(async (req, res) =>
  res.json(await script('addStock', { id: req.params.id, qty: req.body.qty }))));

app.post('/api/bills', wrap(async (req, res) => {
  const { customer, phone, items: cart, prevVP = 0, extraPct = 0 } = req.body;
  if (!cart?.length) throw new Error('Cart is empty');
  const products = (await script('getProducts')).data;
  const items = cart.map(c => {                      // prices come from the sheet, not the browser
    const p = products.find(x => x.id === c.id);
    if (!p) throw new Error('Unknown product');
    return { id: p.id, name: p.name, mrp: +p.mrp, vp: +p.vp, gst: +p.gst, qty: +c.qty };
  });
  const t = calcBill(items, +prevVP, +extraPct);
  const saved = await script('saveBill', { bill: { customer, phone, ...t, items } });
  res.json({ ...saved, ...t, items, customer, phone });
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Morya running on http://localhost:' + port));
