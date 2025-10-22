const START_HOUR = 8, END_HOUR = 17, STEP_MIN = 30, DAYS_AHEAD = 7;
const fmtT = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'});
const fmtD = new Intl.DateTimeFormat(undefined,{weekday:'short',day:'2-digit'});

function start0(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}

function buildGrid(){
  const now=new Date(), today0=start0(now), grid=[];
  for(let d=0; d<DAYS_AHEAD; d++){
    const day0=new Date(today0.getTime()+d*86400000);
    const slots=[];
    for(let h=START_HOUR; h<END_HOUR; h++){
      for(let m=0; m<60; m+=STEP_MIN){
        const start=new Date(day0); start.setHours(h,m,0,0);
        slots.push({id:start.toISOString(),label:fmtT.format(start),isPast:start<now});
      }
    }
    grid.push({date:day0, slots});
  }
  return grid;
}

function renderGrid(el){
  const grid=buildGrid();
  el.innerHTML=grid.map(day=>`
    <div class="day">
      <div class="day-head">${fmtD.format(day.date)}</div>
      ${day.slots.map(s=>`
        <button class="slot ${s.isPast?'past':'free'}" data-id="${s.id}" ${s.isPast?'disabled':''}>
          ${s.label}
        </button>`).join('')}
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded',()=>{
  const root=document.querySelector('#calendar');
  if(root) renderGrid(root);
});
