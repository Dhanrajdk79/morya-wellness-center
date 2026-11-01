const { useState, useEffect, useMemo } = React;
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const api = async (url, body) => {
  const r = await fetch('/api' + url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json(); if (!r.ok) throw new Error(j.error); return j;
};
// shrink image in the browser before upload
const toBase64 = file => new Promise(res => {
  const img = new Image(); img.onload = () => {
    const s = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    res(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
  }; img.src = URL.createObjectURL(file);
});

function App() {
  const [tab, setTab] = useState('stock');
  const [products, setProducts] = useState([]);
  const [msg, setMsg] = useState(null);
  const load = () => api('/products').then(setProducts).catch(e => setMsg({ err: 1, t: e.message }));
  useEffect(() => { load(); }, []);
  const flash = (t, err) => { setMsg({ t, err }); setTimeout(() => setMsg(null), 5000); };
  return (<>
    <header>
      <h1>Morya Wellness Center<small>Stock and billing</small></h1>
      <nav>{[['stock', 'Stock'], ['bill', 'New bill'], ['history', 'Past bills']].map(([k, l]) =>
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
    </header>
    <main>
      {msg && <div className={'msg ' + (msg.err ? 'err' : '')} role="status">{msg.t}</div>}
      {tab === 'stock' && <Stock products={products} reload={load} flash={flash} />}
      {tab === 'bill' && <Billing products={products} reload={load} flash={flash} />}
      {tab === 'history' && <History flash={flash} />}
    </main>
  </>);
}

function Stock({ products, reload, flash }) {
  const empty = { name: '', sku: '', mrp: '', vp: '', gst: 18, stock: '' };
  const [f, setF] = useState(empty), [file, setFile] = useState(null), [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const add = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const imageBase64 = file ? await toBase64(file) : '';
      await api('/products', { ...f, imageBase64, imageType: 'image/jpeg' });
      setF(empty); setFile(null); e.target.reset(); flash('Product added'); reload();
    } catch (er) { flash(er.message, 1); } setBusy(false);
  };
  const addQty = async p => {
    const q = prompt('Add how many units of ' + p.name + '?'); if (!q || isNaN(q)) return;
    try { await api(`/products/${p.id}/stock`, { qty: +q }); flash('Stock updated'); reload(); } catch (er) { flash(er.message, 1); }
  };
  return (<div className="grid">
    <form className="card" onSubmit={add}>
      <h2>Add product</h2>
      <label>Product name</label><input required value={f.name} onChange={set('name')} />
      <label>SKU / code</label><input value={f.sku} onChange={set('sku')} />
      <div className="row"><div><label>MRP (₹)</label><input required type="number" min="0" step="0.01" value={f.mrp} onChange={set('mrp')} /></div>
        <div><label>Volume points</label><input type="number" min="0" step="0.001" value={f.vp} onChange={set('vp')} /></div></div>
      <div className="row"><div><label>GST %</label><select value={f.gst} onChange={set('gst')}>{[0, 5, 12, 18, 28].map(g => <option key={g}>{g}</option>)}</select></div>
        <div><label>Opening stock</label><input required type="number" min="0" value={f.stock} onChange={set('stock')} /></div></div>
      <label>Product photo</label><input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</button>
    </form>
    <div className="card">
      <h2>Stock ({products.length} products)</h2>
      {!products.length && <p className="muted">No products yet. Add your first product on the left.</p>}
      <div className="products">{products.map(p => (
        <div className="prod" key={p.id}>
          {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <div className="noimg">No photo</div>}
          <div className="b"><b>{p.name}</b>
            <span className="muted">{p.sku} · MRP {money(p.mrp)} · {p.vp} VP</span>
            <span className={p.stock <= 5 ? 'low' : ''}>{p.stock} in stock{p.stock <= 5 ? ' (low)' : ''}</span>
            <button className="btn sm" style={{ marginTop: 'auto' }} onClick={() => addQty(p)}>Add stock</button></div>
        </div>))}</div>
    </div>
  </div>);
}

function Billing({ products, reload, flash }) {
  const [tiers, setTiers] = useState([{ minVP: 0, pct: 25 }]);
  const [cart, setCart] = useState([]), [pick, setPick] = useState(''), [qty, setQty] = useState(1);
  const [c, setC] = useState({ customer: '', phone: '', prevVP: 0, extraPct: 0 });
  const [done, setDone] = useState(null);
  useEffect(() => { api('/tiers').then(setTiers); }, []);

  const lines = cart.map(l => ({ ...products.find(p => p.id === l.id), qty: l.qty }));
  const t = useMemo(() => {   // same maths as backend/billing.js
    const vp = lines.reduce((s, i) => s + i.vp * i.qty, 0);
    const pct = [...tiers].reverse().find(x => +c.prevVP + vp >= x.minVP).pct;
    let mrp = 0, net = 0, gst = 0;
    lines.forEach(i => { const m = i.mrp * i.qty, n = m * (1 - pct / 100) * (1 - c.extraPct / 100); mrp += m; net += n; gst += n * i.gst / (100 + +i.gst); });
    const next = tiers.find(x => x.minVP > +c.prevVP + vp);
    return { vp, pct, mrp, disc: mrp * pct / 100, extra: mrp * (1 - pct / 100) * c.extraPct / 100, gst, taxable: net - gst, total: Math.round(net), next, need: next ? next.minVP - (+c.prevVP + vp) : 0 };
  }, [cart, products, tiers, c.prevVP, c.extraPct]);

  const addLine = () => {
    const p = products.find(x => x.id === pick); if (!p || qty < 1) return;
    const have = cart.find(l => l.id === pick)?.qty || 0;
    if (have + +qty > p.stock) return flash('Only ' + p.stock + ' of ' + p.name + ' in stock', 1);
    setCart(have ? cart.map(l => l.id === pick ? { ...l, qty: l.qty + +qty } : l) : [...cart, { id: pick, qty: +qty }]); setQty(1);
  };
  const save = async () => {
    try {
      const r = await api('/bills', { ...c, items: cart });
      setDone(r); setCart([]); reload(); flash('Bill ' + r.billNo + ' saved');
    } catch (er) { flash(er.message, 1); }
  };

  if (done) return <Invoice b={done} onNew={() => setDone(null)} />;
  return (<div className="grid">
    <div className="card">
      <h2>Customer</h2>
      <label>Name</label><input value={c.customer} onChange={e => setC({ ...c, customer: e.target.value })} />
      <label>Phone</label><input value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} />
      <label>VP already bought this month</label><input type="number" min="0" value={c.prevVP} onChange={e => setC({ ...c, prevVP: +e.target.value })} />
      <label>Extra discount % (optional)</label><input type="number" min="0" max="100" value={c.extraPct} onChange={e => setC({ ...c, extraPct: +e.target.value })} />
      <h2 style={{ marginTop: 22 }}>Add item</h2>
      <select value={pick} onChange={e => setPick(e.target.value)}><option value="">Choose a product</option>
        {products.map(p => <option key={p.id} value={p.id} disabled={p.stock < 1}>{p.name} ({p.stock} left)</option>)}</select>
      <div className="row"><input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} aria-label="Quantity" />
        <button className="btn alt" style={{ margin: 0 }} onClick={addLine}>Add to bill</button></div>
    </div>
    <div className="card">
      <h2>Bill</h2>
      <div className="tier"><span>Discount on MRP<br /><small>{t.next ? `${t.need.toFixed(0)} more VP reaches ${t.next.pct}%` : 'Highest level reached'}</small></span><b>{t.pct}%</b></div>
      {!lines.length ? <p className="muted">Pick products to start the bill.</p> : <table>
        <thead><tr><th>Item</th><th className="n">Qty</th><th className="n">MRP</th><th className="n">VP</th><th className="n">Amount</th><th></th></tr></thead>
        <tbody>{lines.map(l => <tr key={l.id}><td>{l.name}</td><td className="n">{l.qty}</td><td className="n">{money(l.mrp)}</td><td className="n">{(l.vp * l.qty).toFixed(2)}</td>
          <td className="n">{money(l.mrp * l.qty)}</td><td><button className="btn sm" onClick={() => setCart(cart.filter(x => x.id !== l.id))}>Remove</button></td></tr>)}</tbody></table>}
      {!!lines.length && <div className="tot">
        <div><span>Total MRP</span><span>{money(t.mrp)}</span></div>
        <div><span>Discount ({t.pct}%)</span><span>− {money(t.disc)}</span></div>
        {c.extraPct > 0 && <div><span>Extra discount ({c.extraPct}%)</span><span>− {money(t.extra)}</span></div>}
        <div><span>Taxable value</span><span>{money(t.taxable)}</span></div>
        <div><span>GST (included in MRP)</span><span>{money(t.gst)}</span></div>
        <div><span>Total VP</span><span>{t.vp.toFixed(2)}</span></div>
        <div className="g"><span>Total</span><span>{money(t.total)}</span></div>
        <button className="btn" style={{ width: '100%' }} onClick={save}>Save bill</button></div>}
    </div>
  </div>);
}

function Invoice({ b, onNew }) {
  return (<div className="card">
    <h2>Morya Wellness Center — Bill {b.billNo}</h2>
    <p className="muted">{b.customer} {b.phone} · {new Date().toLocaleDateString('en-IN')}</p>
    <table><thead><tr><th>Item</th><th className="n">Qty</th><th className="n">MRP</th><th className="n">Amount</th></tr></thead>
      <tbody>{b.items.map(i => <tr key={i.id}><td>{i.name}</td><td className="n">{i.qty}</td><td className="n">{money(i.mrp)}</td><td className="n">{money(i.mrp * i.qty)}</td></tr>)}</tbody></table>
    <div className="tot">
      <div><span>Total MRP</span><span>{money(b.mrpTotal)}</span></div>
      <div><span>Discount ({b.discountPct}%)</span><span>− {money(b.discountAmt)}</span></div>
      {b.extraDiscAmt > 0 && <div><span>Extra discount</span><span>− {money(b.extraDiscAmt)}</span></div>}
      <div><span>Taxable value</span><span>{money(b.taxable)}</span></div>
      <div><span>GST included</span><span>{money(b.gst)}</span></div>
      <div className="g"><span>Total</span><span>{money(b.grandTotal)}</span></div></div>
    <div className="noprint"><button className="btn" onClick={() => window.print()}>Print bill</button> <button className="btn alt" onClick={onNew}>New bill</button></div>
  </div>);
}

function History({ flash }) {
  const [bills, setBills] = useState([]);
  useEffect(() => { api('/bills').then(setBills).catch(e => flash(e.message, 1)); }, []);
  return (<div className="card"><h2>Past bills</h2>
    {!bills.length ? <p className="muted">No bills yet.</p> : <table>
      <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th className="n">VP</th><th className="n">Discount</th><th className="n">Total</th></tr></thead>
      <tbody>{bills.map(b => <tr key={b.billNo}><td>{b.billNo}</td><td>{new Date(b.date).toLocaleDateString('en-IN')}</td><td>{b.customer}</td>
        <td className="n">{b.totalVP}</td><td className="n">{b.discountPct}%</td><td className="n">{money(b.grandTotal)}</td></tr>)}</tbody></table>}
  </div>);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
