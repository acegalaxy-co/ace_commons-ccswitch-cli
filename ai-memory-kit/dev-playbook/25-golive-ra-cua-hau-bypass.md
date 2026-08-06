# 25 — Rà cửa hậu DEV-BYPASS trước khi go-live

🎯 **Vấn đề:** Tên môi trường "production" trên bảng điều khiển triển khai KHÔNG đảm bảo biến `NODE_ENV` bên trong container thực sự bằng `production`. Nếu code gate mọi cửa hậu (bỏ qua OTP, hiện mã dev, tắt 2FA, nạp tiền giả) bằng điều kiện kiểu `NODE_ENV !== 'production'`, chỉ cần lệch 1 biến môi trường lúc tạo môi trường là TOÀN BỘ cửa hậu đó sống công khai trên bản LIVE — cho bất kỳ ai gõ đúng URL.

Bài này gom cách rà + cách gate đúng để không lặp lại lỗ hổng dạng này ở app tiếp theo.

## Cạm bẫy cốt lõi: "tên env production" ≠ "NODE_ENV=production"
- Dùng `NODE_ENV` để bật/tắt tối ưu hoá (minify, log level...) là vô hại.
- Cạm bẫy chết người là dùng CHÍNH biến đó để gate luôn **quyết định bảo mật** (hiện mã OTP demo, bỏ 2FA, cho nạp tiền giả). Khi đó an toàn của cả hệ thống phụ thuộc vào 1 biến dễ set sai và không ai kiểm tra định kỳ.
- Tên môi trường trên giao diện nền tảng triển khai là do người gõ tay; giá trị `NODE_ENV` bên trong container là 1 biến khác — 2 thứ có thể lệch nhau vô thời hạn mà không có cảnh báo nào.

## Sự cố minh hoạ (đã rửa danh tính từ ca thật)
Một backend chạy trên môi trường đặt tên "production", nhưng `NODE_ENV` thực tế vẫn là `development` (sai sót lúc tạo môi trường, không ai phát hiện). Code gate hiển thị mã OTP demo bằng:

```ts
const isDemoVisible = process.env.NODE_ENV !== 'production';
```

Trên bản LIVE biểu thức này trả `true` → MỌI cổng đăng nhập trong hệ thống (quản trị, đối tác, người dùng nội bộ...) hiện thẳng mã OTP demo cho bất kỳ ai gõ đúng email — tương đương chiếm được tài khoản bất kỳ mà không cần mật khẩu thật. Đi kèm: 1 cờ cho phép "nạp tiền giả" bật sẵn trên hệ thống tiền THẬT, và kênh gửi OTP thật (email/SMS) **chưa từng được nối** — hệ chỉ lưu hash mã, không gửi đi đâu cả. Hệ quả: nếu tắt bypass ngay mà chưa nối kênh gửi thật, không ai đăng nhập được → áp lực khiến việc tắt bypass bị trì hoãn, lỗ hổng sống lâu hơn cần thiết.

## Cách xử lý đúng — 5 quy tắc tái dùng

1. **Trước/tại go-live của bất kỳ app nào: rà và liệt kê toàn bộ cờ dev đang set trên môi trường live** — `NODE_ENV` (phải literally = `production`, HOẶC code không được dùng nó để gate bảo mật), mọi cờ dạng `*_DEMO`, `*_DEV_*` (nạp tiền giả, seed dữ liệu...), allowlist bypass. Verify bằng lệnh liệt kê biến môi trường THẬT của nền tảng triển khai — không tin file cấu hình trong repo, vì giá trị thật nằm ở dashboard/CLI của nền tảng.

2. **Không bao giờ gate cửa hậu bằng `NODE_ENV`.** Gate bằng 1 cờ env RIÊNG, tên rõ nghĩa, **mặc định TẮT khi không set** (vd `OTP_DEMO_BYPASS`, `TWOFA_ENFORCE`). Dev local tự bật cờ trong `.env` cục bộ; môi trường live không set là an toàn theo mặc định — không phụ thuộc việc ai đó gõ đúng tên môi trường.

3. **Nối kênh gửi OTP THẬT (email/SMS) TRƯỚC khi tắt bypass.** Nhiều hệ dựng nhanh chỉ lưu hash mã mà quên gọi hàm gửi thật. Gộp cấu hình gửi vào 1 nơi dùng chung, viết 1 helper gửi chung, mọi nơi cần OTP gọi qua helper đó theo kiểu **best-effort fail-soft** (gửi lỗi thì log + báo, không làm sập luồng đăng nhập).

4. **Tách các cửa độc lập.** Bỏ-qua-OTP và bỏ-2FA là 2 quyết định khác nhau, mỗi cái 1 cờ riêng. Tắt cờ này không được tự động kéo theo bật/ép cờ kia — kẻo vô tình khoá luôn người dùng thật chưa kịp cài 2FA.

5. **Verify go-live bằng HÀNH VI THẬT, không tin đọc code.** Gọi thẳng endpoint trên URL live: yêu cầu OTP phải trả về kết quả không kèm mã demo, và mã OTP phải thực sự đến kênh gửi thật (kiểm tra hộp thư/tin nhắn nhận được, không chỉ tin log "đã gửi"). Endpoint dạng nạp-tiền-giả gọi không kèm phiên hợp lệ phải trả 401/403.

## Kỹ thuật bổ trợ: fail-closed boot guard
Đừng chỉ dựa vào việc gate đúng ở nơi dùng cờ — thêm 1 lớp kiểm tra lúc khởi động process, từ chối boot nếu phát hiện tổ hợp nguy hiểm:

```ts
// boot-guard.ts — chạy đầu tiên khi process khởi động
function assertNoDangerousDevFlagsInProd() {
  const isProd = process.env.NODE_ENV === 'production';
  const dangerousFlags: [string, string][] = [
    ['OTP_DEMO_BYPASS', 'OTP_DEMO_BYPASS_ACK_PUBLIC'],
    ['DEV_TOPUP_ENABLED', 'DEV_TOPUP_ACK_PUBLIC'],
  ];
  if (!isProd) return;
  for (const [flag, ackFlag] of dangerousFlags) {
    if (process.env[flag] === '1' && process.env[ackFlag] !== '1') {
      throw new Error(
        `Từ chối khởi động: ${flag}=1 trên production mà chưa xác nhận qua ${ackFlag}=1`
      );
    }
  }
}
```

Mẫu này biến "quên tắt cờ" từ 1 lỗ hổng ÂM THẦM thành 1 sự cố ỒN ÀO (crash lúc deploy) — dễ bắt hơn nhiều so với chờ ai đó tình cờ phát hiện trên live.

## SMTP/SMS mới nối — 1 lưu ý riêng
Nhà cung cấp gửi email/SMS mới thường khởi động ở chế độ **sandbox** (chỉ gửi được tới địa chỉ đã verify trước) — kiểm tra chế độ này và xin quyền gửi thật (production access) trước khi mở OTP cho người dùng ngoài phạm vi nội bộ.

## 📋 Checklist go-live (rà cờ dev-bypass)
- [ ] Liệt kê toàn bộ cờ `*_DEMO` / `*_DEV_*` / allowlist bypass đang set trên môi trường live (đọc từ nền tảng triển khai, không đọc file repo)
- [ ] Xác nhận `NODE_ENV` KHÔNG được dùng để gate bất kỳ quyết định bảo mật nào (grep code)
- [ ] Mọi cờ bypass có tên riêng, rõ nghĩa, mặc định TẮT khi không set
- [ ] Kênh gửi OTP thật (email/SMS) đã nối và test gửi-nhận thành công TRƯỚC khi tắt bypass
- [ ] Bypass OTP và enforce 2FA là 2 cờ độc lập, không cờ nào tự kéo cờ kia
- [ ] Verify bằng hành vi thật trên URL live: không có mã demo trong response, OTP đến đúng kênh
- [ ] Endpoint dev-only (nạp tiền giả, seed data...) trả 401/403 khi không có phiên hợp lệ
- [ ] Có boot guard fail-closed chặn khởi động nếu tổ hợp cờ nguy hiểm xuất hiện trên production
- [ ] SMTP/SMS mới: đã kiểm tra & thoát chế độ sandbox trước khi mở cho người dùng ngoài

## ⚠️ Cạm bẫy
- Tin "tên môi trường là production thì NODE_ENV chắc cũng vậy" — 2 thứ set độc lập, có thể lệch nhau vô thời hạn nếu không ai verify.
- Gate 1 cờ bảo mật bằng `NODE_ENV` vì "tiện, khỏi thêm biến mới" — tiện lúc dựng, nguy hiểm lúc go-live.
- Tắt bypass trước khi nối xong kênh gửi OTP thật → khoá luôn người dùng, áp lực khiến việc tắt bị trì hoãn (lỗ hổng sống lâu hơn).
- Đọc code thấy "đã gate đúng" rồi kết luận an toàn — phải verify bằng gọi thật trên URL live, code đúng không đồng nghĩa biến môi trường đúng.
- Cờ enforce-2FA và cờ bypass-OTP gộp chung logic → tắt cái này vô tình bật/tắt luôn cái kia.

## 🔗 Liên quan
- `03-feature-flag.md` — registry cờ 2 đầu (server+app), nền tảng chung để quản lý mọi loại cờ kể cả cờ demo/bypass.
- `26-robot-tu-va-self-heal.md` — cùng tinh thần fail-safe/mặc định-an-toàn khi trao quyền tự động cho hệ thống.
- `01-deploy-railway-an-toan.md` — biến môi trường theo từng service trên nền tảng triển khai.
