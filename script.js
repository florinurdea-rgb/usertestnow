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
})();