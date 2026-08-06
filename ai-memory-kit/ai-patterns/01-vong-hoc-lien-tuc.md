# 01 — Vòng học liên tục (human-in-the-loop): AI đề xuất → người duyệt → hệ nhớ → tự động dần

🎯 **Vấn đề:** tính năng AI đề-xuất (định khoản, bóc field hóa đơn, phân loại giao dịch, gợi ý…) nếu để "AI tự quyết" thì sai là toang; nếu bắt người làm tay hết thì AI vô dụng. Cần **vòng kín**: đề xuất → người sửa/duyệt → hệ **nhớ theo ngữ cảnh** → lần sau tốt hơn + tăng độ tin → đủ tin thì **tự duyệt**.

## ✅ Cách làm

### Interface chuẩn (mọi domain dùng chung)
```ts
// Học khi người chốt
record(domain: string, contextKey: string, chosen: string, actor: string): Promise<void>
// Gợi ý xếp hạng
suggest(domain: string, contextKey: string): Promise<{ output: string; freq: number; confidence: number }[]>
```
- `domain` = loại việc (`"account_mapping"`, `"invoice_field"`, `"tx_classify"`…).
- `contextKey` = khóa ngữ cảnh **đã chuẩn hóa** (lowercase, bỏ dấu câu thừa, trim) — vd tên nhà cung cấp normalize.

### Schema (1 bảng, tenant-scoped)
```sql
CREATE TABLE learn_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  domain      text NOT NULL,
  context_key text NOT NULL,
  output      text NOT NULL,
  freq        int  NOT NULL DEFAULT 1,
  last_actor  text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, domain, context_key, output)
);
-- RLS: tenant_id theo session/header. record() = upsert ... ON CONFLICT DO UPDATE SET freq = freq+1.
```

### Ngưỡng tự động hóa (tùy domain — rủi ro cao thì ngưỡng cao hơn)
`confidence = freq(output) / tổng_freq(context)`:
- **≥ 60% + freq ≥ 5** → **tự điền** (vẫn cho người sửa trước khi lưu).
- **≥ 90% + freq ≥ 10** → **tự duyệt** (không cần người bấm).

### 3 mô hình triển khai
| Mô hình | Khi nào | Lưu ý |
|---|---|---|
| A. Nhúng mỗi dự án | bắt đầu nhanh, data nhạy cảm | không học chéo dự án |
| B. Dịch vụ tập trung | nhiều dự án, cần học chéo | **rủi ro gộp PII** — chỉ chia tri thức phi-nhạy-cảm |
| **C. Hybrid (khuyên)** | mọi trường hợp | module + interface chung ở thư viện; **data local mỗi tenant**; interface mở để trỏ central sau |

### Đo lường (đừng để hệ tự chấm chính nó)
Chạy eval định kỳ trên bộ test **đã-duyệt, held-out**: `coverage` (% record có gợi ý đạt ngưỡng) + `accuracy` (% gợi ý top-1 khớp lựa chọn thật).

## 📋 Checklist
- [ ] Mọi flow AI-đề-xuất bọc qua vòng đề-xuất→duyệt→record
- [ ] `contextKey` chuẩn hóa nhất quán
- [ ] Ngưỡng tự-điền / tự-duyệt đặt theo rủi ro domain
- [ ] Data học **local mỗi tenant**; central (nếu có) chỉ tri thức phi-nhạy-cảm
- [ ] Có eval held-out đo coverage + accuracy

## ⚠️ Cạm bẫy / lằn ranh
- **PII/data khách KHÔNG gộp não chung** giữa tenant A và B. Kế toán/y tế/tài chính của A không vào kho chung với B.
- Để AI tự duyệt khi chưa đủ freq → sai hàng loạt. Giữ ngưỡng + người ở vòng.
- Eval tự đếm chính nó (không held-out) → số đẹp giả.

> Rửa: tên dự án, tên hàm/bảng có prefix, số đo nội bộ.
