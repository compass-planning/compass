// server/planning/reports/styles.ts
export const REPORT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Georgia:ital@0;1&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --navy:#0F2B4C; --blue:#1E5FA8; --light-blue:#E8F0FA;
    --gold:#C9A84C; --green:#1A7A4A; --green-bg:#EAF5EE;
    --red:#C0392B; --red-bg:#FDECEA; --amber:#D4860A; --amber-bg:#FEF4E2;
    --gray-100:#F7F8FA; --gray-200:#EAECEF; --gray-400:#9BA3AF;
    --gray-600:#4B5563; --gray-700:#374151; --gray-800:#1F2937;
    --text:#1F2937; --border:#D1D5DB;
  }
  html { font-size: 13px; }
  body { font-family:'Inter',system-ui,sans-serif; color:var(--text); background:#F0F2F5; line-height:1.6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { width:816px; min-height:1056px; margin:0 auto 28px; background:white; padding:44px 54px; box-shadow:0 4px 24px rgba(0,0,0,.10); }
  .cover { display:flex; flex-direction:column; min-height:1060px; background:white; }
  .cover-header { background:var(--navy); color:white; padding:40px 56px 32px; margin:-48px -56px 0; }
  .cover-logo-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:48px; }
  .cover-firm-name { font-size:18px; font-weight:600; letter-spacing:.5px; }
  .cover-date { font-size:12px; color:rgba(255,255,255,.7); }
  .cover-label { font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--gold); margin-bottom:12px; }
  .cover-main-title { font-family:Georgia,serif; font-size:36px; font-weight:normal; color:white; line-height:1.2; margin-bottom:16px; }
  .cover-client-name { font-size:20px; font-weight:500; color:rgba(255,255,255,.9); }
  .cover-gold-bar { height:4px; background:linear-gradient(90deg,var(--gold),transparent); margin:32px 0 0; }
  .cover-body { flex:1; padding:48px 0; display:grid; grid-template-columns:1fr 1fr; gap:32px; align-content:start; }
  .cover-info-label { font-size:10px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:var(--gray-400); margin-bottom:6px; }
  .cover-info-value { font-size:14px; font-weight:500; color:var(--gray-800); }
  .cover-sections { grid-column:1/-1; margin-top:32px; padding:24px; background:var(--gray-100); border-left:4px solid var(--navy); border-radius:0 8px 8px 0; }
  .cover-sections-title { font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:var(--navy); margin-bottom:12px; }
  .cover-toc { display:grid; grid-template-columns:repeat(2,1fr); gap:6px 32px; }
  .cover-toc-item { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--gray-600); }
  .cover-toc-dot { width:6px; height:6px; background:var(--gold); border-radius:50%; flex-shrink:0; }
  .cover-footer { margin-top:auto; padding-top:24px; border-top:1px solid var(--border); font-size:10px; color:var(--gray-400); line-height:1.5; }
  .cover-footer strong { color:var(--gray-600); }
  .section-header { border-bottom:3px solid var(--navy); padding-bottom:16px; margin-bottom:28px; }
  .section-eyebrow { font-size:10px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--gold); margin-bottom:6px; }
  .section-title { font-family:Georgia,serif; font-size:26px; font-weight:normal; color:var(--navy); line-height:1.2; }
  .section-subtitle { font-size:13px; color:var(--gray-600); margin-top:6px; }
  .summary-grid { display:grid; gap:12px; margin-bottom:28px; }
  .summary-grid-2{grid-template-columns:repeat(2,1fr)}.summary-grid-3{grid-template-columns:repeat(3,1fr)}.summary-grid-4{grid-template-columns:repeat(4,1fr)}
  .metric-card { padding:16px 20px; border-radius:8px; border:1px solid var(--border); background:white; }
  .metric-card.navy{background:var(--navy);color:white;border-color:var(--navy)}
  .metric-card.blue{background:var(--light-blue);border-color:var(--blue)}
  .metric-card.green{background:var(--green-bg);border-color:var(--green)}
  .metric-card.amber{background:var(--amber-bg);border-color:var(--amber)}
  .metric-card.red{background:var(--red-bg);border-color:var(--red)}
  .metric-label { font-size:11px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; color:var(--gray-400); margin-bottom:6px; }
  .metric-card.navy .metric-label{color:rgba(255,255,255,.65)}
  .metric-value { font-size:22px; font-weight:700; color:var(--gray-800); line-height:1; }
  .metric-card.navy .metric-value{color:white}
  .metric-card.green .metric-value{color:var(--green)}
  .metric-card.amber .metric-value{color:var(--amber)}
  .metric-card.red .metric-value{color:var(--red)}
  .metric-sub { font-size:11px; color:var(--gray-400); margin-top:4px; }
  .metric-card.navy .metric-sub{color:rgba(255,255,255,.55)}
  .table-container { overflow:hidden; border-radius:8px; border:1px solid var(--border); margin-bottom:24px; }
  .table-title { font-size:13px; font-weight:600; color:var(--navy); padding:12px 16px; background:var(--gray-100); border-bottom:1px solid var(--border); }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead tr { background:var(--navy); color:white; }
  thead th { padding:10px 12px; text-align:left; font-weight:600; font-size:11px; letter-spacing:.3px; white-space:nowrap; }
  thead th.right { text-align:right; }
  tbody tr:nth-child(even){background:var(--gray-100)}
  tbody td { padding:8px 12px; border-bottom:1px solid var(--gray-200); }
  tbody td.right { text-align:right; font-variant-numeric:tabular-nums; }
  tfoot tr { background:var(--navy); color:white; }
  tfoot td { padding:10px 12px; font-weight:600; }
  tfoot td.right { text-align:right; }
  .rec-list { display:flex; flex-direction:column; gap:10px; margin-bottom:24px; }
  .rec-item { display:flex; gap:14px; padding:14px 16px; border-radius:8px; border-left:4px solid; }
  .rec-item.immediate{border-color:var(--red);background:var(--red-bg)}
  .rec-item.high{border-color:var(--amber);background:var(--amber-bg)}
  .rec-item.medium{border-color:var(--blue);background:var(--light-blue)}
  .rec-item.low{border-color:var(--green);background:var(--green-bg)}
  .rec-icon { font-size:18px; line-height:1; flex-shrink:0; margin-top:1px; }
  .rec-body { flex:1; }
  .rec-category { font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; margin-bottom:4px; }
  .rec-item.immediate .rec-category{color:var(--red)}
  .rec-item.high .rec-category{color:var(--amber)}
  .rec-item.medium .rec-category{color:var(--blue)}
  .rec-item.low .rec-category{color:var(--green)}
  .rec-text { font-size:12px; color:var(--gray-700); line-height:1.5; }
  .rec-saving { font-size:11px; font-weight:600; color:var(--green); margin-top:4px; }
  .progress-bar-wrap { margin:8px 0; }
  .progress-bar-label { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; }
  .progress-bar-track { height:10px; background:var(--gray-200); border-radius:99px; overflow:hidden; }
  .progress-bar-fill { height:100%; border-radius:99px; background:var(--blue); }
  .progress-bar-fill.green{background:var(--green)}.progress-bar-fill.amber{background:var(--amber)}.progress-bar-fill.red{background:var(--red)}.progress-bar-fill.gold{background:var(--gold)}.progress-bar-fill.navy{background:var(--navy)}
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
  .three-col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:20px; }
  .callout { padding:16px 20px; border-radius:8px; margin-bottom:20px; border:1px solid; font-size:12px; line-height:1.6; }
  .callout.info{background:var(--light-blue);border-color:var(--blue);color:var(--navy)}
  .callout.success{background:var(--green-bg);border-color:var(--green)}
  .callout.warning{background:var(--amber-bg);border-color:var(--amber)}
  .callout.danger{background:var(--red-bg);border-color:var(--red)}
  .callout strong{font-weight:600}
  .doc-header { display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; margin-bottom:24px; border-bottom:1px solid var(--border); }
  .doc-header-client { font-size:12px; font-weight:600; color:var(--navy); }
  .doc-header-right { font-size:11px; color:var(--gray-400); text-align:right; }
  .doc-footer { margin-top:32px; padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:space-between; font-size:10px; color:var(--gray-400); }
  .chart-container { margin:20px 0; padding:16px; border:1px solid var(--border); border-radius:8px; background:white; }
  .chart-title { font-size:13px; font-weight:600; color:var(--navy); margin-bottom:12px; }
  .chart-legend { display:flex; gap:16px; flex-wrap:wrap; margin-top:8px; }
  .legend-item { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--gray-600); }
  .legend-dot { width:10px; height:10px; border-radius:2px; }
  .text-right{text-align:right}.text-center{text-align:center}.font-bold{font-weight:600}
  .text-green{color:var(--green)}.text-red{color:var(--red)}.text-amber{color:var(--amber)}.text-navy{color:var(--navy)}.text-gold{color:var(--gold)}
  .text-sm{font-size:11px}.text-xs{font-size:10px;color:var(--gray-400)}
  .mb-4{margin-bottom:4px}.mb-8{margin-bottom:8px}.mb-12{margin-bottom:12px}.mb-16{margin-bottom:16px}.mb-20{margin-bottom:20px}.mb-24{margin-bottom:24px}.mt-4{margin-top:4px}.mt-16{margin-top:16px}.mt-20{margin-top:20px}
  .divider{height:1px;background:var(--border);margin:20px 0}
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;letter-spacing:.3px}
  .badge.green{background:var(--green-bg);color:var(--green)}.badge.red{background:var(--red-bg);color:var(--red)}.badge.amber{background:var(--amber-bg);color:var(--amber)}.badge.blue{background:var(--light-blue);color:var(--blue)}.badge.navy{background:var(--navy);color:white}
  .no-break{page-break-inside:avoid}
  #printBtn,.print-btn{display:none!important}
  @media screen { #printBtn,.print-btn { display:flex!important; } }
  @media print{
    #printBtn,.print-btn{display:none!important}
    body{background:white}
    .page{width:100%;margin:0;padding:0.75in 0.85in;box-shadow:none;page-break-after:always}
    .page:last-child{page-break-after:avoid}
    thead{display:table-header-group}
  }
  @page{size:letter portrait;margin:0.75in 0.85in}
`;
