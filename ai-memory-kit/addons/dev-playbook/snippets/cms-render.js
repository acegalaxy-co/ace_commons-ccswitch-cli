// cms-render.js — render web bằng cách TIÊM nội dung DB vào HTML gốc (cheerio).
// Giữ nguyên giao diện thiết kế; chỉ thay text/ảnh theo selector. Có fallback + i18n N-ngôn-ngữ.
// Rửa sẵn: selector/field là ví dụ. npm i cheerio.
const cheerio = require('cheerio');

// 1) Nội dung GỐC (fallback khi DB rỗng → trang không bao giờ trắng)
const defaults = {
  hero_title: 'Tiêu đề mặc định',
  hero_img: '/assets/hero.jpg',
};

// 2) i18n: lưu bản dịch bằng key suffix (field__vi, field__ja). 1 ngôn ngữ mặc định.
const DEFAULT_LANG = 'en';
function pick(row, field, lang) {
  if (lang && lang !== DEFAULT_LANG && row[`${field}__${lang}`]) return row[`${field}__${lang}`];
  return row[field] ?? defaults[field];
}

// 3) Gộp DB + defaults theo ngôn ngữ
function resolve(dbRow, lang) {
  const out = {};
  for (const field of Object.keys(defaults)) out[field] = pick(dbRow || {}, field, lang);
  return out;
}

// 4) Tiêm vào HTML gốc bằng cheerio (map: selector → field)
const MAP = {
  '#hero h1': 'hero_title',
  '#hero img': { field: 'hero_img', attr: 'src' },
};
function render(htmlTemplate, dbRow, lang) {
  const $ = cheerio.load(htmlTemplate);
  const data = resolve(dbRow, lang);
  for (const [sel, m] of Object.entries(MAP)) {
    const field = typeof m === 'string' ? m : m.field;
    const val = data[field];
    if (val == null) continue;
    if (typeof m === 'object' && m.attr) $(sel).attr(m.attr, val);
    else $(sel).text(val);
  }
  return $.html();
}

module.exports = { render, resolve, defaults };

// ── Ví dụ dùng (Express) ──
// const tpl = fs.readFileSync('templates/index.html', 'utf8');
// app.get('/', async (req, res) => {
//   const lang = req.cookies.lang || DEFAULT_LANG;
//   const row = await store.loadAll(lang);   // đọc từ DB (đã bật RLS)
//   res.send(render(tpl, row, lang));
// });
// Admin màn-đôi: render(tpl, draftRow, lang) cho khung preview — KHÔNG ghi đè bản live tới khi bấm lưu.
