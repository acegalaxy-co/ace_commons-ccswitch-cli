# 18 — Che PII ở admin + nâng cấp KYC (che · reveal-có-audit · mã hóa · ảnh giấy-tờ riêng-tư)

🎯 **Vấn đề:** app vận hành có **admin xem data khách hàng loạt** → SĐT/email phơi cho mọi admin là thứ **người-mua-doanh-nghiệp soi đầu tiên**. Với KYC tự-khai thì còn nặng hơn: số giấy-tờ, tài khoản ngân hàng, ảnh CCCD nằm plaintext trong DB. Cần bịt lỗ mà **không cản vận hành**.

Bài này giải quyết gì: (A) khuôn che PII ở admin (mask mặc định + nút Hiện-số có audit + quyền riêng) và (B) nâng cấp lên KYC tự-khai + duyệt (state machine + mã hóa at-rest + ảnh giấy-tờ kho riêng-tư).

---

## A. Che PII ở admin (cân bằng bảo vệ ↔ vận hành mượt)

### Thiết kế 3 tầng
| Tầng | Hành vi |
|---|---|
| **Mặc định** (admin thường) | list + chi tiết hiện PII **CHE**: SĐT `090•••••67`, email `d•••n@domain` (giữ đầu + cuối + domain để vẫn đối chiếu) |
| **Nút "Hiện số"** | trả PII THẬT + **ghi audit mỗi lần** (ai xem PII của ai, lúc nào) — truy vết = điểm bán |
| **Quyền RIÊNG** (vd `<miền>:pii`) | cấp cho vai cần (CSKH gọi khách) → bấm Hiện-số được; thiếu quyền → chỉ thấy mask |
| **master/owner** | thấy đầy đủ (giữ quy ước isMaster toàn hệ) |

### Nguyên tắc chốt
- **CHE cái MISUSE được = kênh liên lạc** (SĐT/email). **GIỮ TÊN** — tên không phải kênh liên lạc, vận hành cần xưng hô; che tên làm list vô dụng.
- **Tìm kiếm chạy trên data THẬT** (server-side) — chỉ **giá-trị-TRẢ-RA** bị che → CSKH gõ đúng SĐT vẫn tìm ra khách.
- **Audit KHÔNG chứa PII** trong meta (chỉ ghi `fields: ['phone','email']`) — kẻo audit-log thành chỗ rò mới.
- Reveal phải **MƯỢT** (1 bấm/khách, không chặn cứng) — masking là rào cho người-mua-NGOÀI, không được phá luồng nội bộ.

### Khuôn dựng
- **BE:** helper THUẦN `mask.ts` (`maskPhone`/`maskEmail`, test riêng) · service `search/detail` nhận cờ `maskPii` (mặc định CHE, master tắt) + trả cờ `phoneMasked/emailMasked` · endpoint riêng `GET .../:id/contact` trả số thật + `audit.record('...pii.reveal')`, gate bằng quyền `<miền>:pii`.
- **FE:** `canSeePii()` (isMaster || có quyền pii) ẩn/hiện nút; chi tiết hiện mask + nút "Hiện số" gọi `/contact`; hộp Hướng dẫn 1 dòng giải thích.
- **RBAC:** thêm 1 menu `<miền>:pii` (mức `['view']`) vào catalog quyền → tự vào ma trận phân quyền. Nhớ cập test đếm menu/audit-actions.

### Mở rộng
- Rà các màn admin KHÁC còn lộ PII (đơn hàng/vận đơn…) — NHƯNG SĐT NGƯỜI NHẬN giao hàng vận hành CẦN → cân nhắc, đừng che bừa.
- Tầng cao hơn: log/OPS để DB riêng (đừng để audit/log nhét PII vào DB chính).

---

## B. Nâng cấp KYC tự-khai + duyệt

Mở rộng khuôn (A) thêm **tự-khai + state machine + mã hóa PII + ảnh giấy-tờ riêng-tư**. Áp cho mọi app cần KYC (người bán C2C, nhà đầu tư, đối tác…).

### 5 mảnh ghép
1. **State machine:** `none → submitted → approved/rejected`. Người dùng nộp/khai-lại CHỈ khi `none`/`rejected`; admin duyệt/từ-chối CHỈ khi `submitted` (kèm lý do → khai lại được). Viết bằng **hàm thuần** `canSubmit`/`canReview` (test được, xem `snippets/...`).
2. **Mã hóa số PII at-rest = TÁI DÙNG secret-box có sẵn** (AES-256-GCM, khóa lấy từ biến `CONFIG_ENC_KEY`, dev fallback `JWT_SECRET`) — **KHÔNG dựng crypto mới, KHÔNG cần env key mới** (key này đã có sẵn cho secret cổng thanh toán). Lưu thêm `*_last4` plaintext để **hiển thị CHE không cần giải mã**.
3. **Reveal số thật = quyền RIÊNG (`<miền>:pii`) + GHI AUDIT mỗi lần.** Mặc định DTO trả số CHE; nút "Hiện số" gọi endpoint reveal (GET, level `view`) → giải mã + audit "ai xem PII của ai".
4. **Ảnh giấy-tờ = kho RIÊNG TƯ, KHÔNG public.** ⚠️ service upload asset mặc định thường để bucket PUBLIC → KHÔNG dùng cho giấy-tờ. Dựng service asset riêng dùng **bucket private** (tên lấy từ biến `KYC_BUCKET`); upload trả **PATH** (không URL công khai); admin xem qua **signed-url ngắn hạn** sinh server-side. **Fail-closed graceful** nếu chưa cấu hình bucket → lõi KYC (số mã hóa + mã số thuế + tài khoản NH) vẫn chạy, ảnh là tùy chọn.
5. **Quyền mới → nhớ vá test đếm menu.** Thêm key vào catalog quyền làm số menu đổi → **phải sửa test `toHaveLength`**. (Lỗi lặp: chạy test hẹp thì sót → chạy test LIÊN QUAN rộng.)

### Khi build
- **Soi DB THẬT trước** (đừng tin note): note ghi "đã có cột X" thường SAI → phải migration thêm cột.
- Yêu cầu **mã hóa số giấy-tờ** (quy định bảo vệ dữ liệu cá nhân) → secret-box giải quyết, không cần set env key mới.
- Hạ tầng tái dùng: guard người dùng (seller/investor) + decorator current-user + upload asset + service audit.

## 📋 Checklist
- [ ] PII trả ra mặc định CHE (giữ đầu+cuối+domain); tìm kiếm vẫn chạy trên data thật
- [ ] Nút Hiện-số trả PII thật + ghi audit mỗi lần; audit KHÔNG chứa PII
- [ ] Quyền riêng `<miền>:pii` gate reveal; master thấy đầy đủ
- [ ] KYC dùng state machine hàm thuần none→submitted→approved/rejected
- [ ] Số PII mã hóa at-rest (tái dùng secret-box) + lưu `*_last4` để hiển thị che
- [ ] Ảnh giấy-tờ ở bucket PRIVATE + admin xem qua signed-url ngắn hạn, fail-closed
- [ ] Thêm quyền mới → vá test đếm menu (chạy test liên quan rộng)

## ⚠️ Cạm bẫy
- Che luôn cả TÊN → list vô dụng, vận hành không xưng hô được. Chỉ che kênh liên lạc.
- Che ở tầng tìm-kiếm → gõ đúng SĐT không ra khách. Chỉ che giá-trị-trả-ra.
- Nhét PII vào meta audit → audit thành chỗ rò mới.
- Dùng service asset mặc định (bucket public) cho ảnh giấy-tờ → lộ CCCD ra ngoài.
- Dựng crypto/env-key mới cho KYC → thừa. Tái dùng secret-box sẵn có.
- Thêm quyền quên vá test đếm menu → CI đỏ hoặc lọt số.

## 🔗 Liên quan
- `snippets/pii-mask.ts` — `maskPhone`/`maskEmail` thuần.
- `12-audit-log-undo-confirm.md` — khuôn audit-log (ai·gì·lúc) tái dùng cho reveal.
- `11-dam-bao-chat-luong-4-luoi.md` — quét secret + Zod validate cửa API.
- `snippets/sql-idempotent.sql` — RLS deny-default cho bảng PII.
