#!/usr/bin/env node
// md-to-pdf.mjs — chuyển 1 file Markdown → HTML đẹp (font tiếng Việt + bảng), KHÔNG cần mạng / pandoc.
// Dùng: node md-to-pdf.mjs <input.md> <output.html> ["Tiêu đề"]
// Sau đó in PDF bằng Chrome headless (không cần cài thêm thư viện):
//   macOS:   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="OUT.pdf" "file://OUT.html"
//   Linux:   google-chrome --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="OUT.pdf" "file://OUT.html"
//   Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="OUT.pdf" "file://OUT.html"
// (Cách này chỉ cần Node + 1 trình duyệt Chromium — không cần pandoc/wkhtmltopdf/weasyprint.)
import fs from 'fs';

const [,, inPath, outPath, titleArg] = process.argv;
const src = fs.readFileSync(inPath, 'utf8');
const lines = src.replace(/\r\n/g, '\n').split('\n');

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(text){
  if(text==null) return '';
  const codes = [];
  // bảo vệ inline-code bằng SENTINEL không bao giờ có trong văn bản (tránh đụng số thường như "đội 3")
  text = text.replace(/`([^`]+)`/g, (m,c)=>{ codes.push(c); return '@@C' + (codes.length-1) + '@@'; });
  text = escapeHtml(text);
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m,t,u)=>'<a href="'+u+'">'+t+'</a>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/@@C(\d+)@@/g, (m,i)=>'<code>'+escapeHtml(codes[+i]==null?'':codes[+i])+'</code>');
  return text;
}
function isTableSep(l){ return /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-'); }
function splitRow(l){
  let s = l.trim();
  if(s.startsWith('|')) s = s.slice(1);
  if(s.endsWith('|')) s = s.slice(0,-1);
  return s.split('|').map(c=>c.trim());
}

const out = [];
let i = 0;
while(i < lines.length){
  let line = lines[i];
  if(/^\s*$/.test(line)){ i++; continue; }
  if(/^```/.test(line)){
    const buf=[]; i++;
    while(i<lines.length && !/^```/.test(lines[i])){ buf.push(escapeHtml(lines[i])); i++; }
    i++; out.push('<pre><code>'+buf.join('\n')+'</code></pre>'); continue;
  }
  if(/^---+\s*$/.test(line)){ out.push('<hr>'); i++; continue; }
  let h = line.match(/^(#{1,6})\s+(.*)$/);
  if(h){ const lv=h[1].length; out.push('<h'+lv+'>'+inline(h[2])+'</h'+lv+'>'); i++; continue; }
  if(line.includes('|') && i+1<lines.length && isTableSep(lines[i+1])){
    const header = splitRow(line); i += 2;
    const rows=[];
    while(i<lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])){ rows.push(splitRow(lines[i])); i++; }
    let t = '<table><thead><tr>' + header.map(c=>'<th>'+inline(c)+'</th>').join('') + '</tr></thead><tbody>';
    for(const r of rows){ t += '<tr>' + r.map(c=>'<td>'+inline(c)+'</td>').join('') + '</tr>'; }
    t += '</tbody></table>'; out.push(t); continue;
  }
  if(/^\s*>/.test(line)){
    const buf=[];
    while(i<lines.length && /^\s*>/.test(lines[i])){ buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
    out.push('<blockquote>'+renderInner(buf)+'</blockquote>'); continue;
  }
  if(/^\s*([-*]|\d+\.)\s+/.test(line)){
    const ordered = /^\s*\d+\.\s+/.test(line);
    const items=[];
    while(i<lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])){ items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; }
    const tag = ordered ? 'ol':'ul';
    out.push('<'+tag+'>' + items.map(it=>'<li>'+inline(it)+'</li>').join('') + '</'+tag+'>'); continue;
  }
  const pbuf=[line]; i++;
  while(i<lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|>|\s*([-*]|\d+\.)\s|---+\s*$|```)/.test(lines[i]) && !(lines[i].includes('|') && i+1<lines.length && isTableSep(lines[i+1]))){
    pbuf.push(lines[i]); i++;
  }
  out.push('<p>'+inline(pbuf.join(' '))+'</p>');
}

function renderInner(buf){
  const res=[]; let j=0;
  while(j<buf.length){
    if(/^\s*$/.test(buf[j])){ j++; continue; }
    if(/^\s*([-*]|\d+\.)\s+/.test(buf[j])){
      const items=[];
      while(j<buf.length && /^\s*([-*]|\d+\.)\s+/.test(buf[j])){ items.push(buf[j].replace(/^\s*([-*]|\d+\.)\s+/,'')); j++; }
      res.push('<ul>'+items.map(it=>'<li>'+inline(it)+'</li>').join('')+'</ul>'); continue;
    }
    const pbuf=[buf[j]]; j++;
    while(j<buf.length && !/^\s*$/.test(buf[j]) && !/^\s*([-*]|\d+\.)\s+/.test(buf[j])){ pbuf.push(buf[j]); j++; }
    res.push('<p>'+inline(pbuf.join(' '))+'</p>');
  }
  return res.join('');
}

const title = titleArg || 'Tài liệu';
const css = ':root{-webkit-print-color-adjust:exact;print-color-adjust:exact;}*{box-sizing:border-box;}'
+'body{font-family:-apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif;font-size:12px;line-height:1.5;color:#1a1a1a;max-width:980px;margin:0 auto;padding:8px 4px;}'
+'h1{font-size:21px;border-bottom:3px solid #2b6cb0;padding-bottom:6px;margin:18px 0 10px;color:#1a365d;}'
+'h2{font-size:16.5px;border-bottom:1px solid #cbd5e0;padding-bottom:3px;margin:20px 0 8px;color:#2a4365;page-break-after:avoid;}'
+'h3{font-size:13.5px;margin:14px 0 6px;color:#2c5282;page-break-after:avoid;}'
+'h4{font-size:12.5px;margin:10px 0 4px;color:#2d3748;}'
+'p{margin:6px 0;}a{color:#2b6cb0;text-decoration:none;}'
+'code{background:#f0f1f3;padding:1px 4px;border-radius:3px;font-family:"SF Mono",Menlo,Consolas,monospace;font-size:11px;}'
+'pre{background:#f7f8fa;padding:8px 10px;border-radius:5px;overflow:auto;}pre code{background:none;padding:0;}'
+'hr{border:none;border-top:1px solid #e2e8f0;margin:14px 0;}'
+'blockquote{border-left:4px solid #90cdf4;background:#f5faff;margin:8px 0;padding:4px 12px;color:#2d3748;border-radius:0 4px 4px 0;}blockquote p{margin:4px 0;}'
+'ul,ol{margin:6px 0;padding-left:22px;}li{margin:2px 0;}'
+'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10.5px;page-break-inside:auto;}thead{display:table-header-group;}tr{page-break-inside:avoid;}'
+'th,td{border:1px solid #cbd5e0;padding:4px 7px;text-align:left;vertical-align:top;}th{background:#2b6cb0;color:#fff;font-weight:600;}tbody tr:nth-child(even){background:#f4f7fb;}'
+'strong{font-weight:700;}@page{size:A4;margin:13mm;}';
const html = '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>'+escapeHtml(title)+'</title><style>'+css+'</style></head><body>'+out.join('\n')+'</body></html>';
fs.writeFileSync(outPath, html, 'utf8');
console.log('HTML written:', outPath, '(', html.length, 'bytes )');
