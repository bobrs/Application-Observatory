export const styles = `
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.register-heading { display:flex; align-items:baseline; justify-content:space-between; gap:20px; margin-bottom:20px; }
.register-heading h1 { font:600 28px/1.2 ui-sans-serif,system-ui,sans-serif; letter-spacing:-.7px; margin:0; }
.portfolio-register { border-top:1px solid var(--line); }
.portfolio-row { position:relative; background:#fffefb; border-bottom:1px solid var(--line); }
.row-overview { display:grid; grid-template-columns:minmax(190px,1fr) minmax(190px,1.1fr) minmax(220px,1.25fr); gap:20px; align-items:center; min-height:78px; padding:12px 60px 12px 16px; }
.application-name { font-weight:650; font-size:14px; text-decoration:none; overflow-wrap:anywhere; }
.row-overview p { margin:0; font-size:12px; line-height:1.45; overflow-wrap:anywhere; }
.row-location { color:var(--muted); }
.row-attention span { display:block; font-size:11px; color:var(--muted); margin-top:3px; }
.row-context > summary { position:absolute; right:12px; top:17px; display:grid; place-items:center; width:34px; height:44px; list-style:none; border:1px solid var(--line); border-radius:4px; }
.row-context > summary::-webkit-details-marker { display:none; }
.row-chevron { font-size:22px; line-height:1; }
.row-context[open] > summary .row-chevron { transform:rotate(180deg); }
.row-context { margin:0; }
.expanded-context { border-top:1px solid var(--line); padding:18px 24px 24px; font-size:13px; overflow-wrap:anywhere; }
.expanded-context p { margin:8px 0; }
.stage-summary { list-style:none; padding:0; font-size:13px; }
.register-help { margin-top:18px; max-width:850px; }
.change-version { margin:10px 0 0 8px; }
.destination-heading { flex-wrap:wrap; }
.destination-heading h2 { flex:1; min-width:200px; }
.destination-heading button { margin:0; }
.stage-groups { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr)); gap:20px; align-items:start; }
.stage-group { min-width:0; }
.stage-group .section-heading { align-items:start; }
.stage-group .section-heading h3 { font-size:14px; }
.stage-group .section-heading .count { white-space:nowrap; }
.stage-many { grid-column:1/-1; }
.destination-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr)); gap:18px; }
.reference-card { padding:24px; border-top:4px solid #8a9c68; }
.reference-card:nth-child(2) { border-top-color:#76a5c8; }
.reference-card:nth-child(3) { border-top-color:#c48d64; }
.reference-card .version-number { font-size:clamp(42px,5vw,70px); font-weight:750; letter-spacing:-3px; line-height:1.15; margin:24px 0 6px; color:var(--ink); }
.reference-card time { font-size:11px; }
.demo-warning { font-size:10px; font-weight:750; letter-spacing:1px; color:#854113; }
.latest-action { padding-top:18px; margin-top:20px; border-top:1px solid var(--line); font-size:13px; }
.reference-selection { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.reference-card details { overflow-wrap:anywhere; }
.pending-changes { margin-top:24px; }
.pending-changes article { border-top:1px solid var(--line); padding:16px 0; }
.next-step { margin:16px 0; font-size:13px; }
.next-step h2 { font-size:15px; margin:6px 0; }
.next-step p { margin:4px 0; }
.next-step small { color:var(--muted); font-size:11px; }
.activity { margin-top:24px; }
.activity-list { list-style:none; padding:0; margin:0; }
.activity-list li { border-top:1px solid var(--line); padding:9px 0; }
.activity-list li:first-child { border:0; }
.activity-list p { font-size:13px; margin:0 0 4px; }
.activity-list small { font-size:11px; color:var(--muted); }
.directives,.metadata-evidence { margin-top:24px; }
.directives article { padding:14px 0; border-bottom:1px solid var(--line); }
@media(max-width:800px) { .row-overview { grid-template-columns:1fr; gap:4px; padding:14px 60px 14px 16px; } .reference-selection { grid-template-columns:1fr; gap:0; } }

:root {
  color-scheme:light;
  --ink:#18312e;
  --muted:#52665f;
  --line:#d6e1d8;
  --paper:#f5f7f1;
  --green:#235c49;
  --soft:#e8eee3;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
* {
  box-sizing:border-box;
}
body {
  margin:0;
  background:var(--paper);
  color:var(--ink);
  font-size:16px;
  line-height:1.6;
}
a {
  color:var(--green);
  text-underline-offset:4px;
}
a:hover {
  color:#14382b;
}
a:focus-visible {
  outline:3px solid #ae5f22;
  outline-offset:5px;
}
header {
  border-bottom:1px solid var(--line);
  background:#fcfcf8;
}
.shell {
  max-width:1152px;
  margin:auto;
  padding:0 32px;
}
.topbar {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  min-height:88px;
}
.brand {
  display:flex;
  align-items:center;
  gap:12px;
  color:var(--ink);
  text-decoration:none;
  font-weight:650;
  letter-spacing:-.3px;
}
.mark {
  width:28px;
  height:28px;
  border:1.5px solid var(--green);
  border-radius:50%;
  display:grid;
  place-items:center;
}
.mark::after {
  content:"";
  width:8px;
  height:8px;
  border-radius:50%;
  background:var(--green);
}
.mode,.eyebrow {
  text-transform:uppercase;
  letter-spacing:1.7px;
  font-size:11px;
  font-weight:700;
}
.mode {
  color:var(--muted);
  border-left:1px solid var(--line);
  padding-left:20px;
}
main {
  padding-top:50px!important;
  padding-bottom:50px!important;
}
.eyebrow {
  color:var(--green);
  margin:0 0 10px;
}
h1 {
  font-family:Georgia,"Times New Roman",serif;
  font-size:clamp(34px,4.5vw,52px);
  font-weight:400;
  letter-spacing:-1.8px;
  line-height:1.14;
  margin:0 0 18px;
}
h2 {
  font-size:20px;
  line-height:1.3;
  letter-spacing:-.4px;
  margin:0 0 12px;
}
h3 {
  font-size:16px;
  margin:0;
}
.intro {
  color:var(--muted);
  max-width:640px;
  margin:0 0 28px;
  font-size:17px;
}
.notice {
  padding:16px 20px;
  background:var(--soft);
  border-left:3px solid #8a9c68;
  color:#354c3e;
  font-size:14px;
  margin-bottom:32px;
}
.section-heading {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  margin:28px 0 16px;
}
.section-heading h2 {
  margin:0;
}
.count {
  font-size:12px;
  color:var(--muted);
}
.panel {
  background:#fffefb;
  border:1px solid var(--line);
  border-radius:8px;
  padding:28px;
}
.catalog-heading {
  display:flex;
  align-items:start;
  justify-content:space-between;
  gap:24px;
}
.catalog-heading h2 {
  font-size:25px;
}
.purpose {
  max-width:610px;
  margin:0 0 18px;
  color:var(--muted);
}
.tag {
  display:inline-block;
  border:1px solid #bfcbb8;
  border-radius:30px;
  padding:3px 10px;
  white-space:nowrap;
  font-size:12px;
  color:#4d6249;
}
.metadata-line {
  font-size:13px;
  color:var(--muted);
  margin:8px 0;
}
.environments {
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:16px;
  margin:24px 0;
}
.environment {
  padding:18px;
  background:#f5f7f2;
  border:1px solid #dfe6da;
  border-radius:5px;
}
.environment h3 {
  margin-bottom:14px;
}
.unknown {
  display:inline-flex;
  align-items:center;
  gap:8px;
  font-size:14px;
  font-weight:650;
}
.unknown::before {
  content:"";
  border:1.5px solid #6b7a67;
  border-radius:50%;
  width:8px;
  height:8px;
}
.environment p {
  font-size:12px;
  color:var(--muted);
  margin:8px 0 0;
}
.environment dl {
  font-size:12px;
  display:grid;
  grid-template-columns:auto 1fr;
  gap:5px 12px;
  margin:14px 0 0;
}
.environment dt {
  color:var(--muted);
}
.environment dd {
  margin:0;
}
.next {
  border-top:1px solid var(--line);
  padding-top:20px;
  margin-top:24px;
}
.next p {
  margin:5px 0;
  font-size:14px;
}
.next .eyebrow {
  font-size:10px;
}
.next small,.source-note {
  font-size:12px;
  color:var(--muted);
}
.catalog-footer {
  margin-top:22px;
  display:flex;
  gap:16px;
  align-items:center;
  justify-content:space-between;
}
.button-link {
  display:inline-block;
  padding:9px 15px;
  border:1px solid var(--green);
  border-radius:4px;
  text-decoration:none;
  font-size:13px;
  font-weight:650;
}
.button-link:hover {
  background:var(--soft);
}
.breadcrumbs {
  font-size:13px;
  margin:0 0 24px;
}
.detail-grid {
  display:grid;
  grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);
  gap:24px;
}
.facts {
  margin:0;
}
.facts dt {
  color:var(--muted);
  font-size:12px;
  margin-top:18px;
}
.facts dt:first-child {
  margin-top:0;
}
.facts dd {
  margin:4px 0;
  font-size:14px;
  overflow-wrap:anywhere;
}
.facts code {
  font-size:11px;
}
.detail-environments .environments {
  grid-template-columns:1fr;
  margin-bottom:0;
}
.detail-environments .environment {
  padding:16px;
}
.detail-environments .environment h3 {
  margin-bottom:8px;
}
.detail-environments .environment dl {
  margin-top:8px;
}
.fine-print {
  font-size:12px;
  color:var(--muted);
  margin:18px 0 0;
}
footer {
  border-top:1px solid var(--line);
  padding:22px 0;
  color:var(--muted);
  font-size:12px;
}
.footer-row {
  display:flex;
  justify-content:space-between;
  gap:20px;
}
.footer-row p {
  margin:0;
}
time {
  font-variant-numeric:tabular-nums;
}
.skip-link {
  position:absolute;
  top:-100px;
  left:16px;
  background:white;
  padding:10px;
  z-index:1;
}
.skip-link:focus {
  top:10px;
}
@media(max-width:720px) {
  .shell {
    padding:0 20px;
  }
  .topbar {
    min-height:76px;
    align-items:flex-start;
    justify-content:center;
    flex-direction:column;
    gap:4px;
    padding:14px 0;
  }
  .mode {
    border:0;
    padding:0 0 0 40px;
    font-size:9px;
  }
  main {
    padding-top:32px!important;
  }
  .panel {
    padding:20px;
  }
  .catalog-heading {
    flex-direction:column;
    gap:8px;
  }
  .catalog-heading h2 {
    font-size:22px;
  }
  .environments {
    grid-template-columns:1fr;
    gap:10px;
  }
  .environment {
    padding:15px;
  }
  .environment h3 {
    margin-bottom:8px;
  }
  .catalog-footer,.footer-row {
    align-items:flex-start;
    flex-direction:column;
    gap:12px;
  }
  .detail-grid {
    grid-template-columns:1fr;
  }
  .notice {
    padding:14px;
    font-size:13px;
  }
  h1 {
    letter-spacing:-1px;
  }
  .intro {
    font-size:16px;
  }
}
.exercise-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; }
.selection { margin-top:28px; }
label { display:block; font-size:14px; font-weight:600; margin:14px 0; }
input,select,textarea { display:block; width:100%; font:inherit; font-weight:400; color:var(--ink); background:#fffefb; border:1px solid #a9b9aa; border-radius:4px; padding:10px; margin-top:6px; }
button { font:inherit; font-size:14px; font-weight:600; background:var(--green); color:white; border:1px solid var(--green); border-radius:4px; padding:10px 16px; margin:14px 0 0; cursor:pointer; }
button:disabled { background:#e5e9e2; color:#53634e; border-color:#c5cfc0; cursor:not-allowed; }
input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible,summary:focus-visible { outline:3px solid #ae5f22; outline-offset:3px; }
.checkbox { display:flex; gap:10px; align-items:flex-start; font-size:12px; font-weight:400; }
.checkbox input { width:auto; margin-top:5px; }
details { font-size:13px; margin:14px 0; }
summary { cursor:pointer; color:var(--green); font-weight:600; }
.hash,pre { font-family:ui-monospace,monospace; font-size:11px; overflow-wrap:anywhere; word-break:break-word; }
pre { white-space:pre-wrap; background:var(--paper); padding:14px; border-radius:4px; }
.timeline { padding-left:22px; font-size:13px; }
.timeline li { padding:10px 0; border-bottom:1px solid var(--line); }
.timeline p { margin:4px 0; }
@media(max-width:720px) { .exercise-grid { grid-template-columns:1fr; } }
`;
