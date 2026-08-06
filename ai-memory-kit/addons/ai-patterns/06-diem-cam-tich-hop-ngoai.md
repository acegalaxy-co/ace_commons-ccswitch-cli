# 06 — Điểm-cắm tích hợp ngoài: thêm kênh (SMS/email/push/webhook/thanh-toán) mà không vỡ luồng

🎯 **Bài này giải quyết gì:** app cần gửi ra ngoài (SMS, email, push, webhook, cổng thanh toán) nhưng provider thật **chưa có** hoặc **thay đổi tùy khách**. Nếu code cứng provider vào luồng nghiệp vụ thì: chưa cấu hình là vỡ (OTP/đơn hàng chết theo), và thêm kênh mới phải sửa khắp nơi. Cần pattern **"điểm-cắm"** để thêm kênh = ~1 file + 2 dòng wire, và **thiếu cấu hình thì im lặng bỏ qua, KHÔNG làm vỡ luồng chính**.

## ✅ Kiến trúc (5 mảnh, ráp 1 lần)

### 1. `Sender` — interface chung mỗi kênh
```ts
interface Sender {
  readonly channel: string;
  send(msg: OutMessage): Promise<void>; // NÉM lỗi nếu gửi thất bại → worker bắt → retry → quá ngưỡng = 'failed'
}
```

### 2. `SenderRegistry` — map kênh → sender, mặc định stub
```ts
class SenderRegistry {
  private map = new Map<string, Sender>();
  // MẶC ĐỊNH mọi kênh = StubSender (log + coi như đã gửi)
  register(real: Sender) { this.map.set(real.channel, real); } // GHI ĐÈ kênh tương ứng
  dispatch(msg: OutMessage) {
    const s = this.map.get(msg.channel) ?? this.map.get('inapp')!; // kênh lạ → stub
    return s.send(msg);
  }
}
```
`StubSender` = log-and-noop: **chưa có provider thật vẫn chạy được toàn hệ**, thay bằng `register(realSender)` khi sẵn sàng.

### 3. `<Kênh>Service` — gọi provider THẬT, best-effort FAIL-SOFT
```ts
async function send(cfgKey: string, msg: OutMessage): Promise<{ sent: boolean; via: string }> {
  const cfg = await integrationConfig.getResolved<Cfg>(cfgKey);
  if (!cfg || !integrationConfig.isActive(cfgKey)) return { sent: false, via: 'none' }; // KHÔNG ném
  const res = await fetchWithTimeout(cfg.endpoint, { /* ... */ }); // mọi gọi bên-thứ-3 qua fetchWithTimeout
  return { sent: true, via: cfg.provider };
}
```
**Chưa cấu hình / tắt → trả `{sent:false}`, KHÔNG ném** → luồng OTP/đơn/tiền không vỡ theo. Provider `'log'` = chế độ demo.

### 4. `<Kênh>Sender implements Sender` — nối payload vào Service
Rút field từ `payload` (số điện thoại/người nhận + nội dung/template); **thiếu field → LOG cảnh báo + bỏ qua KHÔNG ném** (lỗi dữ liệu, retry vô ích) → gọi Service.

### 5. Wire (2 dòng + đăng ký):
- Service vào module nền tảng (providers + exports).
- Sender vào module notification providers + **`registry.register()` ở `onModuleInit`** + thêm tên kênh vào danh sách stub mặc định + 1 entry trong **gateway-registry** (`secretFields` / `settingFields`) → admin tự có form nhập key.

## ✅ Cấu hình = config-by-key, KHÔNG hardcode

Mỗi kênh 1 KEY (`'sms'` / `'email'` / `'push'` …) trong gateway-registry; **admin nhập secret (mã hoá lưu DB) + setting** + bật/tắt + sandbox/live. **Secret KHÔNG vào code/repo/bộ nhớ.**

## ✅ Lưu ý theo loại kênh

- Nhiều **kênh SMS/thông báo** bắt **template duyệt trước**: chỉ gửi `template_id` + `template_data`, **không gửi nội dung tự do**. Chuẩn hóa số điện thoại đúng định dạng provider yêu cầu (có/không dấu `+`, mã quốc gia).
- **Cổng thanh toán**: cùng khuôn, nhưng phần callback/webhook phải xác thực chữ ký + idempotent (xem `../dev-playbook/17-toan-ven-tien.md`).

## ✅ Thêm kênh mới = ~1 file + 2 dòng

Viết `<Kênh>Service` + `<Kênh>Sender` (thường gộp gọn 1 file) theo đúng khuôn kênh có sẵn → wire 2 dòng + 1 entry gateway-registry. **Không đụng luồng nghiệp vụ.**

## 📋 Checklist
- [ ] Có interface `Sender` + registry map kênh→sender
- [ ] Mặc định mọi kênh = StubSender (log-and-noop) → `register()` ghi đè khi có provider thật
- [ ] Service best-effort fail-soft: chưa cấu hình → `{sent:false}`, KHÔNG ném
- [ ] Config-by-key ở admin, secret mã hoá, không hardcode
- [ ] Mọi gọi provider bên-thứ-3 qua `fetchWithTimeout` (timeout cứng)
- [ ] Thêm kênh mới ≈ 1 file + 2 dòng wire

## ⚠️ Cạm bẫy
- Gửi lỗi mà NÉM ở tầng service → kéo sập luôn luồng OTP/đơn/tiền. Fail-soft.
- Gọi provider không timeout → treo cả connection pool. `fetchWithTimeout`.
- Hardcode secret provider vào code → lộ + không đổi theo khách được. Config-by-key.
- Gửi nội dung tự do cho kênh bắt template duyệt trước → bị từ chối. Dùng đúng template_id.

## Liên quan
- `../dev-playbook/14-giam-sat-job-nen.md` — worker retry + hàng đợi lỗi
- `../dev-playbook/17-toan-ven-tien.md` — idempotent cho callback thanh toán
- `04-connector-mcp-toan-nghiep-vu.md` — cũng kiểu điểm-cắm (registry + gate)

> Rửa: tên dự án, tên provider/cổng thanh toán/kênh SMS cụ thể, PR#, tên module/thư viện nội bộ.
