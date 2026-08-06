# 05 — Nơi chạy tự-động-hóa: chọn theo "có gọi AI không" (đừng để máy cá nhân gánh tim của business)

🎯 **Bài này giải quyết gì:** một việc tự-động (cron, worker nền, tính năng AI) nên **chạy Ở ĐÂU** — máy cá nhân, cloud, hay VPS? Chọn sai thì hoặc tốn tiền vô lý (đốt phí API không cần), hoặc **rủi ro chết người** (bộ não của 1 business treo trên máy cá nhân, máy ngủ là im lặng). Cần một quy tắc chọn đơn giản.

## 🧭 HỎI TRƯỚC: việc này CÓ GỌI AI (đốt token) KHÔNG?

Soi **code thật** (grep tên SDK AI / lời gọi API messages) — **đừng đoán**. Rồi xếp tầng:

| Loại việc | Gọi AI? | Chi phí | NƠI CHẠY đúng |
|---|---|---|---|
| **Cron/automation RULE-BASED** (gửi email mẫu, đối soát, đổi trạng thái, quét cảnh báo) | ❌ Không | 0đ | **Scheduler cloud** (CI scheduled job / cron của PaaS / pinger ngoài). **KHÔNG cần máy cá nhân, KHÔNG cần tài khoản AI.** |
| **Tính năng AI TRONG app phục vụ khách** (trợ lý, tóm tắt, chấm điểm real-time) | ✅ Có | **API key, phải đặt TRẦN chi tiêu** | Chạy trong app (trên cloud/PaaS). App cloud **KHÔNG dùng được gói thuê bao cá nhân** → buộc phải dùng API key → **bắt buộc cài van trần-chi-tiêu**. |
| **AI tự-động đốt token nhiều, muốn NÉ phí API** (tự soạn nội dung cá-nhân-hóa hàng loạt, agent nền) | ✅ Có | Gói thuê bao (né API) | **Agent headless trên một tài-khoản-phụ** (đăng nhập bằng token OAuth của gói thuê bao) → đặt trên **server/VPS**, KHÔNG máy cá nhân. |
| **Agent AI làm DEV** (phiên coding như thế này) | ✅ Có | Gói thuê bao | Máy dev của mình / VPS — đã đúng sẵn. |

**Điểm mấu chốt hay nhầm:** app chạy trên cloud không "mượn" được gói thuê bao cá nhân của bạn (gói đó gắn tài khoản người, không phải hạ tầng). Nên: tính năng AI phục vụ khách = API key (có trần); còn muốn xài gói thuê bao để né phí = phải là agent headless đăng nhập token, đặt trên server.

## ⛔ ĐỪNG để MÁY CÁ NHÂN gánh "tim" của 1 BUSINESS

- Worker phục vụ **cá nhân bạn** (trợ lý chat riêng, tự soi site của mình) chạy máy cá nhân 24/7 = OK (hỏng tí không sao).
- Nhưng tự-động-hóa của **app chạy thật phục vụ khách** mà treo máy cá nhân → **3 rủi ro:**
  1. Máy ngủ / tắt / cúp điện → **cron im lặng** (lằn ranh lớn nhất: cron im lặng nguy hơn cron lỗi-có-báo).
  2. Bị buộc vào đúng 1 máy (không có máy dự phòng chạy thay).
  3. **Không bán được sản phẩm mà bộ não chạy trên máy cá nhân của người sáng lập** → hạ tầng phải đi theo SẢN PHẨM (cloud/VPS), không theo người.
- App đã sống trên cloud thì tự-động của nó nên ở **cạnh app**, đừng vắt qua internet về máy cá nhân.

## 🛟 Buộc phải giữ trên máy cá nhân? Lưới giảm-thiểu (không phải đích đến)

> Nếu vì lý do nào đó CHƯA/KHÔNG chuyển được ngay "tim" của app lên hạ tầng thật, dưới đây là lưới giảm-thiểu rủi ro — không thay thế được việc chuyển hạ tầng, chỉ để đỡ đau trong lúc chưa chuyển.

### Bộ giám sát tiến-trình OS (process supervisor)
Nếu vẫn phải chạy nhiều tiến trình nền dài hạn trên máy cá nhân (worker, daemon...), đừng để mỗi cái tự sống tự chết rời rạc — dựng **1 bộ giám sát chung**:
- **Sổ đăng ký tiến-trình** đầy đủ (tên, loại — thường trực vs định kỳ) + **tự phát hiện tiến-trình LẠ** đang chạy trên máy nhưng chưa có trong sổ (khớp theo tiền tố định danh của mình) → không bao giờ sót cái mới thêm mà quên đăng ký.
- **Heal KHÔNG giết tiến-trình đang sống**: phát hiện tiến trình chết (PID rỗng) → khởi động lại đúng cái đó; tiến trình đang chạy tốt thì để yên tuyệt đối, không "restart cho chắc" cả loạt.
- **Vòng watchdog định kỳ**: một tiến trình canh riêng, chạy mỗi N phút, tự gọi heal — im lặng khi mọi thứ ổn, chỉ lên tiếng khi có sự cố.
- **Phát hiện crash-loop**: cơ chế tự-khởi-động-lại có sẵn của hệ điều hành thường **buông tay khi crash-loop quá nhanh** (vượt ngưỡng throttle) và **không tự dựng lại nếu tiến trình bị gỡ hẳn khỏi danh sách quản lý**. Vá lỗ này bằng cách lưu trạng thái PID của từng tiến trình giữa các lượt kiểm tra → đếm số lần **đổi PID trong một cửa sổ thời gian ngắn** (vd ≥4 lần trong <15 phút) → vượt ngưỡng thì báo động "chờn vờn" thay vì cứ lặng lẽ restart mãi mà không ai biết.

### Cầu nối gián-tiếp cloud ↔ máy-cá-nhân khi KHÔNG có đường mạng trực tiếp
App/bảng điều khiển chạy trên cloud thường **không với tới được** tiến trình chạy trên máy cá nhân (bảo mật hệ điều hành chặn; mở cổng hay dựng VPN vào máy cá nhân là rủi ro không đáng). Nếu vẫn cần "xem + điều khiển" tiến trình đó từ xa:
- **Dùng lại 1 bảng DB chung sẵn có** (không dựng thêm hạ tầng mới) làm **hàng-đợi-lệnh + trạng-thái**: phía cloud ghi lệnh vào đó, phía máy cá nhân đọc và thi hành rồi ghi lại trạng thái/nhật ký — thay vì mở cổng vào mạng nhà hay dựng VPN riêng.
- **API phía cổng (cloud) phải có admin-gate** — chỉ người có quyền mới ghi được lệnh vào hàng đợi.
- **Phía máy cá nhân: poll-và-thực-thi, offline-first** — tự đọc hàng đợi theo chu kỳ rồi thi hành; mạng lỗi hay DB tạm không tới KHÔNG được làm hỏng việc tự-heal cục bộ (heal vẫn phải chạy được dù mất kết nối cloud).
- ⚠️ **Đây là giải pháp ĐÁNH ĐỔI, không phải đích đến** — vẫn nên chuyển "tim" của app lên hạ tầng thật (cloud/VPS) khi có điều kiện; cầu nối này chỉ để có tầm nhìn + điều khiển tối thiểu trong lúc chưa chuyển được.

### ⚠️ Cạm bẫy kỹ thuật: `unhandledRejection` giết tiến trình dù đã có try/catch
Một số driver DB chạy trên promise (kiểu client Postgres thuần JS) có thể reject **một promise nội bộ không gắn `await` nào** khi kết nối chết đột ngột (pool bị ngắt/quá tải). Khi đó runtime phát ra `unhandledRejection` và **mặc định giết tiến trình luôn** — kể cả khi vòng lặp chính đã bọc try/catch cẩn thận (try/catch chỉ bắt được nhánh có `await`, không bắt được promise rơi rớt kiểu này).
- **Vá bằng lưới an toàn CẤP TIẾN TRÌNH**: gắn handler bắt `unhandledRejection` ngay sau khi khởi tạo kết nối DB.
- Lưới này **CHỈ được nuốt đúng lớp lỗi kết-nối-DB đã biết** (khớp bằng regex mã lỗi cụ thể: timeout, reset, connection-lost...) rồi log + để tiến trình sống tiếp — **lỗi LẠ vẫn phải cho nổ** (đừng nuốt bừa, giấu mất bug thật; để supervisor/watchdog restart & báo động đúng vai của nó).
- Xem thêm `../dev-playbook/14-giam-sat-job-nen.md` (4 lớp giám sát job nền) + `../dev-playbook/15-gotchas-thuong-gap.md` (cạm bẫy runtime khác) — lưới này chỉ là 1 lớp trong bức tranh đầy đủ.

## 🔑 Lưu ý vận hành

- Scheduler cloud phải đặt **secret xác thực cho endpoint cron** (một biến bí mật kiểu `<CRON_SECRET>`) → thiếu secret thì endpoint **fail-closed** (503), đừng mở toang. Đặt secret vào két bí mật, không hardcode.
- Cron/worker nền → cắm **4 lớp giám sát** (xem `../dev-playbook/14-giam-sat-job-nen.md`): fail-closed · heartbeat cho monitor ngoài · hàng đợi lỗi có UI xử · alert best-effort (không re-throw).
- Nếu chạy agent headless bằng gói thuê bao trên VPS: dùng **tài khoản phụ riêng** (đừng đụng tài khoản chính đang dev), lưu token OAuth vào biến môi trường trên VPS.

## 📋 Checklist
- [ ] Đã grep code thật để biết việc có gọi AI không (không đoán)
- [ ] Rule-based → scheduler cloud, không đụng máy cá nhân
- [ ] Tính năng AI phục vụ khách → API key + van trần chi tiêu
- [ ] AI đốt token muốn né phí → agent headless (token thuê bao) trên VPS
- [ ] Tự-động của app cloud KHÔNG treo trên máy cá nhân
- [ ] Endpoint cron fail-closed + 4 lớp giám sát

## ⚠️ Cạm bẫy
- Nghĩ app cloud "xài ké" được gói thuê bao cá nhân → không được. App cloud = API key.
- Chạy cron của business trên máy cá nhân "cho tiện" → máy ngủ là im lặng, không ai biết.
- Bật tính năng AI phục vụ khách mà quên van trần → 1 vòng lặp/abuse là cháy hóa đơn.

## Liên quan
- `../dev-playbook/14-giam-sat-job-nen.md` — 4 lớp giám sát job nền
- `04-connector-mcp-toan-nghiep-vu.md` — connector MCP (agent điều khiển app)
- `../dev-playbook/01-deploy-railway-an-toan.md` — deploy an toàn lên PaaS

> Rửa: tên dự án, tên PaaS/CDN cụ thể, tên biến secret thật, tên máy/VPS riêng, tên gói thuê bao/nhà cung cấp AI cụ thể.
