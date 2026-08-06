// health-check.ts — endpoint /health + script poll sau deploy.
// Rửa sẵn: không tên dự án/secret. Thay <db-ping> bằng ping DB thật của bạn.

// ── 1) Endpoint (Express) ──
import type { Request, Response } from 'express';

export async function health(_req: Request, res: Response) {
  try {
    // ping nhẹ phần phụ thuộc sống-còn (DB…). Đừng làm nặng.
    // await db.query('select 1');   // <db-ping>
    res.status(200).json({ ok: true, ts: Date.now() });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: String(e?.message || e) });
  }
}
// app.get('/health', health);

// ── 2) Script poll sau deploy (chạy trong CI hoặc tay) ──
// node verify-deploy.mjs https://<domain>/health
export async function waitHealthy(url: string, tries = 20, gapMs = 3000): Promise<boolean> {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'deploy-verify' } });
      if (r.ok) { console.log(`✅ healthy sau ${i} lần thử`); return true; }
      console.log(`… lần ${i}: HTTP ${r.status}`);
    } catch (e: any) { console.log(`… lần ${i}: ${e?.message}`); }
    await new Promise(r => setTimeout(r, gapMs));
  }
  console.error('❌ KHÔNG healthy sau khi hết lượt thử'); return false;
}

// ── 3) Kiểm FE đã là bản MỚI chưa (200 ≠ bản mới) ──
// Tìm 1 marker/route chỉ có ở bản mới (vd chuỗi version, tên route mới).
export async function feHasMarker(indexUrl: string, marker: string): Promise<boolean> {
  const html = await (await fetch(indexUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const ok = html.includes(marker);
  console.log(ok ? `✅ FE có marker "${marker}" (bản mới)` : `⏳ FE CHƯA thấy marker "${marker}" (có thể cache/bản cũ)`);
  return ok;
}
