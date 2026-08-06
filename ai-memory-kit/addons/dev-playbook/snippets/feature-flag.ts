// feature-flag.ts — bật/tắt tính năng 2 đầu (server + client), điều khiển runtime từ Admin.
// Rửa sẵn: tên tính năng là ví dụ. Thay store in-memory bằng bảng DB `feature_flags` của bạn.

export type Scope = 'server' | 'client' | 'both';

// ── 1) Registry tĩnh: khai báo MỌI tính năng 1 chỗ (thêm dòng TRƯỚC khi code tính năng) ──
export const FEATURES = {
  example_feature: { label: 'Tính năng ví dụ', scope: 'both' as Scope, default: false },
  // checkout:      { label: 'Thanh toán',    scope: 'both', default: false },
} as const;
export type FeatureKey = keyof typeof FEATURES;

// ── 2) Nguồn trạng thái runtime (thay bằng DB + cache) ──
export interface FlagStore { get(key: string): Promise<boolean | undefined>; }
// Ví dụ DB: SELECT enabled FROM feature_flags WHERE key=$1  (cache ~30s để khỏi query mỗi request)

export class FeatureService {
  private store: FlagStore;
  constructor(store: FlagStore) { this.store = store; }
  async isOn(key: FeatureKey): Promise<boolean> {
    const db = await this.store.get(key);
    return db !== undefined ? db : FEATURES[key].default; // chưa set trong DB → dùng default
  }
  async enabledMap(scope?: Scope): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const k of Object.keys(FEATURES) as FeatureKey[]) {
      if (scope && FEATURES[k].scope !== scope && FEATURES[k].scope !== 'both') continue;
      out[k] = await this.isOn(k);
    }
    return out;
  }
}

// ── 3) Guard phía SERVER (Express middleware) — chặn logic khi tắt ──
export function requireFeature(svc: FeatureService, key: FeatureKey) {
  return async (_req: any, res: any, next: any) => {
    if (await svc.isOn(key)) return next();
    return res.status(403).json({ error: 'feature_disabled', feature: key });
  };
}
// app.use('/api/checkout', requireFeature(svc, 'checkout'), checkoutRouter);

// ── 4) Endpoint cho APP/FE đọc cờ (ẩn UI, không cần rebuild) ──
// app.get('/api/features', async (_req, res) => res.json(await svc.enabledMap('client')));
// FE: const f = await (await fetch('/api/features')).json(); if (!f.checkout) hideCheckoutButton();

// ── 5) Admin đổi runtime (nhớ ghi audit ai-đổi-gì-lúc-nào) ──
// app.put('/api/features/:key', adminOnly, async (req, res) => { await saveFlag(req.params.key, !!req.body.enabled); res.json({ ok: true }); });
