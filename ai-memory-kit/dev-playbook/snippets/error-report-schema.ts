// error-report-schema.ts — "đầu báo lỗi" nhẹ gửi về hộp lỗi trung tâm.
// Nguyên tắc: fail-safe (không làm hỏng request thật), fingerprint gom trùng, rửa PII tại nguồn.
import { createHash } from 'node:crypto';

export interface ErrorReport {
  service: string;          // tên dịch vụ
  env: 'dev' | 'prod';
  severity: 'info' | 'warn' | 'error' | 'fatal';
  category: string;         // 'db' | 'http' | 'logic' | 'money' ...
  route?: string;
  requestId?: string;
  userHash?: string;        // KHÔNG để userId/email trần — hash/cắt
  errorType: string;
  message: string;
  stack?: string;           // rút gọn vài dòng đầu
  fingerprint: string;      // gom trùng
  ts: number;
}

// Rửa PII tại nguồn: hash định danh, đừng gửi email/sđt/tên trần.
export function hashId(id?: string): string | undefined {
  if (!id) return undefined;
  return createHash('sha256').update(id).digest('hex').slice(0, 12);
}

// Fingerprint: gom lỗi GIỐNG NHAU (service+route+type+ dòng stack đầu) → 1 nhóm, chống spam.
export function fingerprint(p: { service: string; route?: string; errorType: string; stack?: string }): string {
  const head = (p.stack || '').split('\n').find(l => l.includes('at ')) || '';
  return createHash('sha256').update([p.service, p.route, p.errorType, head].join('|')).digest('hex').slice(0, 16);
}

// Reporter FAIL-SAFE: lỗi của reporter KHÔNG được kéo sập request thật (fire-and-forget + try/catch).
// + chống bão lỗi: rate-limit theo fingerprint (1 sự cố lặp ≠ nghìn alert).
const seen = new Map<string, number>();
export function report(partial: Omit<ErrorReport, 'fingerprint' | 'ts'>, sink: (r: ErrorReport) => void) {
  try {
    const fp = fingerprint(partial);
    const now = Date.now();
    const last = seen.get(fp) || 0;
    if (now - last < 60_000) return;      // cùng lỗi trong 60s → bỏ (chống bão)
    seen.set(fp, now);
    const r: ErrorReport = { ...partial, fingerprint: fp, ts: now };
    Promise.resolve().then(() => { try { sink(r); } catch { /* nuốt */ } }); // không await, không ném
  } catch { /* reporter không bao giờ làm hỏng luồng chính */ }
}

// ⚠️ VÙNG TIỀN: nếu nối "tự vá", category 'money'/nghi-đụng-tiền → CHỈ đề xuất, KHÔNG tự sửa. Chờ người duyệt.
