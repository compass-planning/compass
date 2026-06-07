// server/planning/reports/components.ts
import type { ReportMeta } from "../types.js";
import { PROVINCE_NAMES } from "../data/taxData2024.js";

// ── Bilingual labels ──────────────────────────────────────────────────────────
function L(meta: ReportMeta, en: string, fr: string): string {
  return meta.locale === "fr" ? fr : en;
}

export const fmt = {
  dollar:(n:number,decimals=0)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n),
  pct:(n:number,decimals=1)=>`${(n*100).toFixed(decimals)}%`,
  num:(n:number)=>new Intl.NumberFormat("en-CA").format(Math.round(n)),
  age:(n:number)=>`Age ${n}`,
  year:(n:number)=>n.toString(),
};

function formatDate(d:string):string{try{return new Date(d).toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"});}catch{return d;}}

export function coverPage(meta:ReportMeta,sections:string[]):string{
  const{client,advisor,reportDate,reportTitle}=meta;
  return `<div class="page cover">
  <div class="cover-header">
    <div class="cover-logo-row"><div><div class="cover-firm-name">${advisor.companyName}</div>${advisor.licenseNumber?`<div class="cover-date">Licence: ${advisor.licenseNumber}</div>`:""}</div><div class="cover-date">${reportDate}</div></div>
    <div style="padding:64px 0 48px"><div class="cover-label">${L(meta,"Confidential Financial Plan","Plan financier confidentiel")}</div><div class="cover-main-title">${reportTitle}</div><div class="cover-client-name">${L(meta,"Prepared for","Préparé pour")} ${client.fullName}</div></div>
    <div class="cover-gold-bar"></div>
  </div>
  <div class="cover-body">
    <div class="cover-info-block"><div class="cover-info-label">${L(meta,"Client","Client")}</div><div class="cover-info-value">${client.fullName}</div>${client.spouseFirstName?`<div class="cover-info-value" style="margin-top:4px">${client.spouseFirstName} ${client.spouseLastName||""}</div>`:""}</div>
    <div class="cover-info-block"><div class="cover-info-label">${L(meta,"Date of Birth","Date de naissance")}</div><div class="cover-info-value">${formatDate(client.dateOfBirth)} (${L(meta,"Age","Âge")} ${client.age})</div></div>
    <div class="cover-info-block"><div class="cover-info-label">${L(meta,"Province","Province")}</div><div class="cover-info-value">${PROVINCE_NAMES[client.province]}</div></div>
    <div class="cover-info-block"><div class="cover-info-label">${L(meta,"Advisor","Conseiller")}</div><div class="cover-info-value">${advisor.fullName}</div></div>
    <div class="cover-info-block"><div class="cover-info-label">${L(meta,"Report Date","Date du rapport")}</div><div class="cover-info-value">${reportDate}</div></div>
    <div class="cover-info-block"><div class="cover-info-label">${L(meta,"Plan Reference","Référence du plan")}</div><div class="cover-info-value">${meta.planId?`Plan #${meta.planId}`:L(meta,"Draft","Ébauche")}</div></div>
    <div class="cover-sections"><div class="cover-sections-title">${L(meta,"This Report Contains","Ce rapport contient")}</div><div class="cover-toc">${sections.map(s=>`<div class="cover-toc-item"><div class="cover-toc-dot"></div>${s}</div>`).join("")}</div></div>
  </div>
  <div class="cover-footer"><strong>${L(meta,"Confidential:","Confidentiel :")}</strong> ${L(meta,`This financial plan has been prepared exclusively for ${client.fullName} by ${advisor.fullName} of ${advisor.companyName}. The information contained herein is based on data provided by the client and is subject to change. This plan is not a guarantee of future performance and should be reviewed annually or upon major life events.`,`Ce plan financier a été préparé exclusivement pour ${client.fullName} par ${advisor.fullName} de ${advisor.companyName}. Les informations contenues sont basées sur les données fournies par le client et sont sujettes à modification. Ce plan ne constitue pas une garantie de performance future et devrait être révisé annuellement ou lors de changements de vie importants.`)} ${meta.disclaimer}</div>
</div>`;
}

export function pageHeader(meta:ReportMeta,section:string):string{
  return `<div class="doc-header"><div class="doc-header-client">${meta.client.fullName}</div><div class="doc-header-right">${section}<br>${meta.reportDate}</div></div>`;
}
export function pageFooter(page:number,total:number,firm:string,locale?:string):string{
  const conf = locale === "fr" ? "Confidentiel" : "Confidential";
  return `<div class="doc-footer"><span>${firm} &mdash; ${conf}</span><span>Page ${page}</span></div>`;
}
export function sectionHeader(eyebrow:string,title:string,subtitle?:string):string{
  return `<div class="section-header"><div class="section-eyebrow">${eyebrow}</div><div class="section-title">${title}</div>${subtitle?`<div class="section-subtitle">${subtitle}</div>`:""}</div>`;
}
interface MetricCard{label:string;value:string;sub?:string;variant?:string}
export function metricGrid(cards:MetricCard[],cols:2|3|4=4):string{
  return `<div class="summary-grid summary-grid-${cols}">${cards.map(c=>`<div class="metric-card ${c.variant??""}"><div class="metric-label">${c.label}</div><div class="metric-value">${c.value}</div>${c.sub?`<div class="metric-sub">${c.sub}</div>`:""}</div>`).join("")}</div>`;
}
export function dataTable(title:string,headers:{label:string;right?:boolean}[],rows:(string|number)[][],footerRow?:(string|number)[]):string{
  return `<div class="table-container no-break">${title?`<div class="table-title">${title}</div>`:""}<table><thead><tr>${headers.map(h=>`<th${h.right?' class="right"':""} >${h.label}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>`<td${headers[i]?.right?' class="right"':""}>${typeof cell==="number"?fmt.dollar(cell):cell}</td>`).join("")}</tr>`).join("")}</tbody>${footerRow?`<tfoot><tr>${footerRow.map((cell,i)=>`<td${headers[i]?.right?' class="right"':""}>${typeof cell==="number"?fmt.dollar(cell):cell}</td>`).join("")}</tr></tfoot>`:""}</table></div>`;
}
export function recommendationList(recs:{priority:string;category:string;text:string;saving?:number}[]):string{
  const icons:Record<string,string>={immediate:"&#9888;",high:"&#9873;",medium:"&#8505;",low:"&#9745;"};
  return `<div class="rec-list">${recs.map(r=>`<div class="rec-item ${r.priority}"><div class="rec-icon">${icons[r.priority]??""}</div><div class="rec-body"><div class="rec-category">${r.priority.toUpperCase()} PRIORITY &mdash; ${r.category}</div><div class="rec-text">${r.text}</div>${r.saving&&r.saving>0?`<div class="rec-saving">Estimated benefit: ${fmt.dollar(r.saving)}</div>`:""}</div></div>`).join("")}</div>`;
}
export function callout(text:string,variant:"info"|"success"|"warning"|"danger"="info"):string{
  return `<div class="callout ${variant}">${text}</div>`;
}
export function progressBar(label:string,value:number,max:number,color="blue",showPct=true):string{
  const pct=Math.min(100,max>0?(value/max)*100:0);
  return `<div class="progress-bar-wrap"><div class="progress-bar-label"><span>${label}</span>${showPct?`<span>${fmt.pct(value)} ${max>0?`(${pct.toFixed(0)}%)`:""}</span>`:""}</div><div class="progress-bar-track"><div class="progress-bar-fill ${color}" style="width:${pct}%"></div></div></div>`;
}
export function twoCol(left:string,right:string):string{return `<div class="two-col">${left}${right}</div>`;}
export function divider():string{return `<div class="divider"></div>`;}
export function badge(text:string,color:string):string{return `<span class="badge ${color}">${text}</span>`;}

export function barChart(title:string,data:{label:string;value:number;color?:string}[],width=680,height=200):string{
  if(!data.length)return"";
  const maxVal=Math.max(...data.map(d=>d.value),1),barW=(width-80)/data.length-8,chartH=height-50;
  const colors=["#1E5FA8","#C9A84C","#1A7A4A","#D4860A","#0F2B4C","#9BA3AF"];
  const bars=data.map((d,i)=>{const bH=(d.value/maxVal)*chartH,x=60+i*((width-80)/data.length)+4,y=chartH-bH+10,color=d.color??colors[i%colors.length];return `<rect x="${x}" y="${y}" width="${barW}" height="${bH}" fill="${color}" rx="3"/><text x="${x+barW/2}" y="${y-4}" text-anchor="middle" font-size="9" fill="#4B5563">${fmt.dollar(d.value)}</text><text x="${x+barW/2}" y="${height-8}" text-anchor="middle" font-size="10" fill="#4B5563">${d.label}</text>`;}).join("");
  const gridLines=[0,.25,.5,.75,1].map(p=>{const y=chartH-(chartH*p)+10,val=maxVal*p;return `<line x1="55" y1="${y}" x2="${width-10}" y2="${y}" stroke="#EAECEF" stroke-width="1"/><text x="50" y="${y+3}" text-anchor="end" font-size="9" fill="#9BA3AF">${fmt.dollar(val)}</text>`;}).join("");
  return `<div class="chart-container no-break"><div class="chart-title">${title}</div><svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${gridLines}${bars}</svg></div>`;
}

export function lineChart(title:string,series:{label:string;data:{x:number;y:number}[];color?:string}[],width=680,height=220):string{
  if(!series.length||!series[0].data.length)return"";
  const allY=series.flatMap(s=>s.data.map(d=>d.y)),allX=series.flatMap(s=>s.data.map(d=>d.x));
  const minX=Math.min(...allX),maxX=Math.max(...allX),maxY=Math.max(...allY,1),minY=Math.min(0,...allY);
  const pL=70,pR=20,pT=20,pB=35,chartW=width-pL-pR,chartH=height-pT-pB;
  const colors=["#1E5FA8","#C9A84C","#1A7A4A","#D4860A","#0F2B4C"];
  const toX=(x:number)=>pL+((x-minX)/(maxX-minX||1))*chartW, toY=(y:number)=>pT+chartH-((y-minY)/(maxY-minY||1))*chartH;
  const gridLines=[0,.25,.5,.75,1].map(p=>{const y=pT+chartH*(1-p),val=minY+(maxY-minY)*p;return `<line x1="${pL}" y1="${y}" x2="${width-pR}" y2="${y}" stroke="#EAECEF" stroke-width="1"/><text x="${pL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="#9BA3AF">${fmt.dollar(val)}</text>`;}).join("");
  const xStep=Math.ceil((maxX-minX)/10);
  const xLabels=[];for(let x=minX;x<=maxX;x+=xStep)xLabels.push(`<text x="${toX(x)}" y="${height-6}" text-anchor="middle" font-size="9" fill="#9BA3AF">${x}</text>`);
  const paths=series.map((s,si)=>{const color=s.color??colors[si%colors.length],pts=s.data.map(d=>`${toX(d.x)},${toY(d.y)}`).join(" L ");return `<path d="M ${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;}).join("");
  const legend=series.map((s,si)=>{const color=s.color??colors[si%colors.length];return `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div><span>${s.label}</span></div>`;}).join("");
  return `<div class="chart-container no-break"><div class="chart-title">${title}</div><svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${gridLines}${xLabels.join("")}${paths}<line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+chartH}" stroke="#D1D5DB" stroke-width="1"/><line x1="${pL}" y1="${pT+chartH}" x2="${width-pR}" y2="${pT+chartH}" stroke="#D1D5DB" stroke-width="1"/></svg><div class="chart-legend">${legend}</div></div>`;
}

export function donutChart(title:string,segments:{label:string;value:number;color?:string}[],size=180):string{
  const total=segments.reduce((s,d)=>s+d.value,0);if(!total)return"";
  const colors=["#1E5FA8","#C9A84C","#1A7A4A","#D4860A","#0F2B4C","#9BA3AF"];
  const cx=size/2,cy=size/2,r=size*0.38,ir=size*0.22;
  let start=-Math.PI/2;
  const slices=segments.map((seg,i)=>{const slice=(seg.value/total)*2*Math.PI,end=start+slice,x1=cx+r*Math.cos(start),y1=cy+r*Math.sin(start),x2=cx+r*Math.cos(end),y2=cy+r*Math.sin(end),large=slice>Math.PI?1:0,ix1=cx+ir*Math.cos(end),iy1=cy+ir*Math.sin(end),ix2=cx+ir*Math.cos(start),iy2=cy+ir*Math.sin(start),color=seg.color??colors[i%colors.length],path=`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`;start=end;return `<path d="${path}" fill="${color}" stroke="white" stroke-width="2"/>`;}).join("");
  const legend=segments.map((s,i)=>{const pct=((s.value/total)*100).toFixed(1),color=s.color??colors[i%colors.length];return `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div><span>${s.label}: ${pct}%</span></div>`;}).join("");
  return `<div class="chart-container no-break" style="display:flex;gap:24px;align-items:center"><div><div class="chart-title">${title}</div><svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${slices}</svg></div><div class="chart-legend" style="flex-direction:column">${legend}</div></div>`;
}
