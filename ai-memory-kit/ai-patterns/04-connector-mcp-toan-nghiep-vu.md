# 04 — Connector MCP phủ trọn nghiệp vụ: cho team thao tác app qua trợ lý AI

🎯 **Bài này giải quyết gì:** muốn admin/staff điều khiển TRỌN nghiệp vụ 1 app (đọc báo cáo · sửa dữ liệu · thao tác tiền) bằng cách chat với trợ lý AI (client hỗ trợ MCP) thay vì mò từng màn quản trị — nhưng phải AN TOÀN (không rò PII, không lỡ tay chuyển tiền, không mở toang khi chưa sẵn sàng). Cần **khung connector MCP** gắn được vào mọi app + **quy trình dựng** cho việc lớn.

## ✅ Khung (tái dùng nguyên)

- **1 endpoint** `/api/mcp` (route trong app) nhận JSON-RPC theo chuẩn MCP.
- **Token per-user** băm `sha256` (bảng `mcp_tokens`) → lớp `auth` tra profile role; **CHỈ admin/staff** vào. ⚠️ Nếu server dùng khóa service-role bypass RLS thì RLS không còn bảo vệ → **phải tự chặn quyền ở tầng app** (mỗi handler kiểm tra role + tenant), đừng dựa vào RLS.
- Trợ lý AI (client MCP) thường bắt **OAuth 2.1** (discovery RFC 8414/9728 + Dynamic Client Registration + PKCE) — **không có ô dán token thủ công**, phải dựng đủ luồng OAuth.
- **Tool model:** mỗi tool là `McpTool { name, title, description, kind, inputSchema (JSON Schema cho AI đọc), schema (validator runtime), handler }`. Gom vào `registry` (`ALL_TOOLS`). **Dispatcher**: validate input → **gate theo `kind`** → chạy handler → ghi audit.

## ✅ 5 KIND + cờ "bật DẦN" (mặc định AN TOÀN)

Chia mọi tool theo mức rủi ro, mỗi mức 1 cờ bật/tắt lưu trong bảng cấu hình (`settings.key='mcp'`), **đổi cờ KHÔNG cần deploy**:

| KIND | Cờ | Mặc định | Nghĩa |
|---|---|---|---|
| `read` | `enabled` | **false** (chờ go-live) | đọc/báo cáo |
| `write` | `write_enabled` | true | tạo/sửa dữ liệu thường |
| `money` | `money_write_enabled` | **false** | đụng dòng tiền |
| `delete` | `delete_enabled` | **false** | xóa |
| `pii_reveal` | `pii_reveal_enabled` | **false** | lộ PII đầy đủ |

Thêm cờ cho **cụm nhạy** tùy app: ví dụ `cost_read_enabled` (giá vốn), `sensitive_enabled` (gate cả ĐỌC một cụm nhạy — dispatcher chặn theo prefix tên tool). → bật từng nhóm một, từ an toàn nhất ra.

⚡ **ĐỔI CỜ = HIỆU LỰC NGAY, không reconnect/deploy** — nhờ 2 quyết định thiết kế:
1. Route đọc `getMcpConfig(db)` **mỗi request** (KHÔNG cache).
2. `tools/list` luôn trả **TOÀN BỘ `ALL_TOOLS`** — cờ **chỉ chặn lúc GỌI** ở dispatcher, KHÔNG ẩn tool khỏi danh sách.

→ Bật 1 cờ trên bảng settings thì lần gọi tool kế tiếp đã ăn ngay, kể cả trong đúng cuộc chat đang mở; chủ app không phải gỡ/nối lại connector. Hệ quả: tool nhạy vẫn nằm trong list khi đang khóa, gọi vào thì trả **"đang TẮT"** — **bảo mật nằm ở GATE, không ở việc ẩn tool**.

## ✅ Nguyên tắc MỖI tool

- **READ che PII** (`maskPhone`/`maskEmail`/`maskFreeText`) + ẩn giá vốn + email nhân viên. Lộ đầy đủ **chỉ** qua tool `*_reveal` (kind `pii_reveal`) + ghi audit.
- **GHI → `logAudit`** (ai · làm gì · lúc nào; KHÔNG dump args thô/PII). Handler **GỌI lib nghiệp vụ sẵn có** (chuyển kho / ghi sổ quỹ / kích hoạt gói / xác nhận đơn…), **KHÔNG nhân bản SQL phức tạp** trong handler.
- **MONEY:** idempotent + kiểm trạng thái terminal trước khi chạy + **KHÔNG in giá trị tiền nhạy ra text trả về AI** (dữ liệu chat có thể bị lưu). Việc "tạo nháp/tạo phiếu" xếp `write` (chưa đụng tiền); chỉ "thu/chi/xác nhận thanh toán" mới xếp `money`.
- **Đổi cấu hình nhạy** (chính cờ `mcp` / cổng thanh toán) → cần confirm + guard admin.

## ✅ QUY TRÌNH dựng (việc lớn → đa agent)

1. **Khảo sát schema song song** — 1 agent/cụm, đọc **migration THẬT** (đừng đoán cột) → liệt kê cột · PII · trường tiền · thao tác admin · đề xuất bộ tool.
2. **Viết SPEC** (trong `docs/`) → chủ chốt duyệt (nhất là phần tiền).
3. **Dựng song song** — 1 agent/cụm, mỗi cụm 1 **FILE riêng** (`<cụm>-tools.ts`), **KHÔNG đụng** `registry`/`config` (agent chính tự nối → tránh conflict). Dặn agent **KHÔNG chạy full build** (nhiều agent build đè nhau).
4. **Rà phản biện ≥2 đội độc lập** — soi: PII có rò không · gate `kind` gán sai không · query builder có lỗ inject (`.or()`…) không · money đã idempotent chưa · logic → vá → type-check 0 lỗi vùng mcp.
5. **PR → chủ merge** (cổng go-live). **Bật dần:** đọc/báo cáo → ghi nhẹ → tiền (chỉ sau khi vá toàn-vẹn-tiền + smoke test).

**5 lỗ toàn-vẹn-tiền cần vá TRƯỚC khi bật `money`** (xem `../dev-playbook/17-toan-ven-tien.md`): unique index sổ tiền `(ref_type, ref_id, category)` · idempotency-key cho ghi tay/thanh toán · hóa đơn atomic + `UNIQUE(order_id)` + số chứng từ theo **sequence** (không `Date.now`) · hoàn kho idempotent (check movement type) · tránh read-compute-write hở (dùng RPC atomic).

## 🐛 GOTCHA đắt: connector qua CDN/anti-bot bị chặn UA bot (403 dù OAuth đúng)

**Triệu chứng:** trợ lý AI báo **"Authorization with the MCP server failed"** DÙ luồng OAuth chạy trọn (đăng nhập OK, access token đã cấp, log server xác nhận). Token **không bao giờ được dùng** (`last_used_at` = null) → tức trợ lý AI không hề gọi lại endpoint MCP.

**Gốc rễ:** app đứng sau **CDN/WAF/anti-bot** có bật "chặn AI bot / scraper". Đăng nhập OAuth chạy trong **trình duyệt** (UA thường) nên qua; còn **gọi tool là server-to-server dùng UA bot** của trình gọi (ví dụ một UA dạng `*-User`) → bị CDN trả **403 TRƯỚC khi tới app** → "code đúng mà vẫn fail".

**Chẩn nhanh (không cần log):** so 2 lần curl khác User-Agent:
```bash
# UA bot của trình gọi tool → 403 = bị CDN chặn
curl -s -o /dev/null -w "%{http_code}" -X POST https://<domain>/api/mcp \
  -H "user-agent: <UA-bot-cua-trinh-goi>" -d '{}'
# UA trình duyệt → 200/401 = qua → khẳng định chặn theo UA
curl -s -o /dev/null -w "%{http_code}" -X POST https://<domain>/api/mcp \
  -H "user-agent: Mozilla/5.0" -d '{}'
```
403 có header `server: <cdn>` + body ngắn kiểu "request was blocked" + chặn TOÀN path = anti-bot của CDN (không phải app).

**FIX:** trong dashboard CDN/WAF (của chủ domain) → tạo rule **Skip / whitelist** cho các path connector ở **MỌI tầng chặn-bot**:
```
starts_with(uri.path, "/api/mcp") OR starts_with(uri.path, "/.well-known/oauth")
```
Sau fix, curl UA bot phải trả **401** (qua edge, vào app) thay vì 403.

⚠️ **Bài học chốt:** khi MCP connector "authorization failed" mà OAuth ĐÃ cấp token → **nghi NGAY edge/CDN chặn UA bot**, đừng chỉ soi code OAuth. CDN/WAF/anti-bot + connector AI là xung đột kinh điển → khi mở connector, **whitelist path `/api/mcp` + `/.well-known/oauth` ở tất cả các lớp chặn-bot** (kể cả nhiều lớp WAF chồng nhau).

## 📋 Checklist
- [ ] 1 endpoint `/api/mcp`, token per-user sha256, chỉ admin/staff
- [ ] Nếu dùng service-role bypass RLS → tự chặn quyền ở tầng app
- [ ] Tool có `kind`; dispatcher gate theo kind trước khi chạy
- [ ] 5 KIND + cờ, mặc định AN TOÀN, đọc config mỗi request, `tools/list` full
- [ ] READ che PII; lộ đầy đủ chỉ qua `*_reveal` + audit
- [ ] MONEY idempotent, không in tiền nhạy ra text, vá 5 lỗ toàn-vẹn-tiền trước khi bật
- [ ] Whitelist path connector ở mọi tầng CDN/WAF/anti-bot

## ⚠️ Cạm bẫy
- Dựa RLS trong khi server dùng service-role bypass → không được bảo vệ. Chặn ở app.
- Ẩn tool nhạy khỏi `tools/list` để "bảo mật" → bảo mật đặt sai chỗ. Đặt ở GATE.
- Cache config → đổi cờ không ăn ngay. Đọc mỗi request.
- In giá trị tiền/PII ra text trả AI → lưu vào lịch sử chat. Không in.
- Quên whitelist path connector ở CDN → OAuth đúng vẫn fail 403.

## Liên quan
- `../dev-playbook/17-toan-ven-tien.md` — 5 lỗ toàn-vẹn-tiền
- `../dev-playbook/12-audit-log-undo-confirm.md` — audit · undo · confirm
- `05-noi-chay-tu-dong-hoa.md` — nơi chạy tự-động-hóa (có/không gọi AI)
- `../dev-playbook/11-dam-bao-chat-luong-4-luoi.md` — rà phản biện đa đội
- `03-red-team-agent.md` — soi bảo mật trước go-live khối PII/tiền

> Rửa: tên dự án, số lượng tool, PR#, hash, tên bảng có prefix, tên CDN/anti-bot cụ thể, domain, UA bot cụ thể của trình gọi.
