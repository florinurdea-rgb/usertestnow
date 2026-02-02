(function(){
  const $ = (s,el=document)=>el.querySelector(s);
  $("#year").textContent = new Date().getFullYear();

  function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', bottom:'20px', right:'20px', padding:'12px 14px',
      background:'#11171f', border:'1px solid #1b2330', color:'#e9eef7',
      borderRadius:'12px', zIndex:9999, boxShadow:'0 8px 24px rgba(0,0,0,.25)'
    });
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 2400);
  }

  ["workshop-form","library-form","contact-form"].forEach(id=>{
    const f = document.getElementById(id);
    if(!f) return;
    f.addEventListener('submit', ()=>{
      const data = Object.fromEntries(new FormData(f).entries());
      localStorage.setItem(id, JSON.stringify({data, at:new Date().toISOString()}));
      toast("Thanks! We'll reply shortly.");
      f.reset();
    });
  });

  const quoteForm = document.getElementById('quote-form');
  if(quoteForm){
    const priceEl = document.getElementById('quote-price');
    const rangeEl = document.getElementById('quote-range');

    const currency = (value) => `$${value.toLocaleString('en-US')}`;

    const updateQuote = () => {
      const data = new FormData(quoteForm);
      const scope = data.get('scope') || 'medium';
      const goals = data.getAll('goals');
      const urgency = Number(data.get('urgency') || 2);

      const baseMap = { small: 8000, medium: 12000, large: 18000 };
      const goalBoost = goals.length * 1200;
      const urgencyFactor = urgency === 1 ? 0.9 : urgency === 3 ? 1.2 : 1;
      const total = Math.round((baseMap[scope] + goalBoost) * urgencyFactor);
      const min = Math.round(total * 0.85);
      const max = Math.round(total * 1.15);

      priceEl.textContent = currency(total);
      rangeEl.textContent = `Range ${currency(min)} – ${currency(max)}`;
    };

    quoteForm.addEventListener('input', updateQuote);
    updateQuote();
  }
})();
