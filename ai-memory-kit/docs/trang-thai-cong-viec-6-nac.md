# Máy trạng thái 6 nấc cho từng VIỆC (task-state)

> Trang này giải bài **"bảng tiến độ nói đã xong, nhưng thực tế chưa chạy thật"** — lỗi hay gặp khi một hệ đủ lớn có nhiều việc nhỏ chạy song song, nhiều phiên AI/nhiều người cùng đụng. Chỉ cần đọc khi dự án đã vượt qua giai đoạn "vài việc, nhớ hết bằng mắt" — dự án nhỏ cứ dùng bảng ✅ xong / 🔄 đang làm / ⏳ chưa (xem `templates/tien-do.template.md`) là đủ, đừng vác bộ máy này vào cho ca đơn giản.

## 1. Đừng lẫn 2 khái niệm: "mảnh xong chưa" vs "việc xong chưa"

Kit này đã có `status:` ở đầu mỗi mảnh ghi chú (frontmatter) — đó là **vòng đời của TÀI LIỆU**: `live · wip · blocked · plan · research · maintain · done · reference · archived` (xem `docs/methodology.md`, Phụ lục A). Nó trả lời câu "mảnh ghi chú này còn cần đọc/cập nhật không".

Nhưng một mảnh — nhất là `_backlog.md` của một dự án — thường gom **NHIỀU việc nhỏ** cùng lúc: "thêm màn hình đăng nhập", "nối cổng thanh toán", "bật khuyến mãi cuối năm"... Mỗi việc có vòng đời RIÊNG, hạt mịn hơn hẳn cả mảnh. Gắn chung 1 nhãn `status:` cho cả mảnh là quá thô — mảnh có thể ghi `wip` trong khi 3/5 việc bên trong đã chạy thật xong xuôi, hoặc ngược lại.

| | `status:` (frontmatter mảnh) | **task-state** (từng việc) |
|---|---|---|
| Đơn vị | 1 file ghi chú | 1 dòng checklist |
| Trả lời | "tài liệu này còn sống không" | "việc này tới đâu rồi" |
| Sống ở đâu | đầu file (frontmatter) | trong thân file backlog, dạng `- [ ]` / `- [x]` |
| Đổi khi nào | khi cả chủ đề đổi pha | mỗi khi 1 việc nhích 1 nấc |

**Quy tắc:** task-state luôn sống **trong file backlog của dự án đó** (`<Dự án>/_backlog.md` hoặc tương đương) — không mở thêm 1 file riêng cho mỗi việc. Mỗi dòng checklist = 1 việc = 1 nấc trạng thái tại 1 thời điểm.

## 2. Máy trạng thái 6 nấc

```
plan → wip → blocked → done → verified → activated
              (nhánh phụ, chờ NGOÀI)
```

| Nấc | Nghĩa | Ai/gì thường đẩy nấc | Ví dụ dấu hiệu |
|---|---|---|---|
| **plan** | Đã ghi nhận, chưa ai đụng tay | người lên kế hoạch | mới thêm dòng vào backlog |
| **wip** | Đang code/đang làm thật | người làm (AI/team) | có commit trên nhánh riêng |
| **blocked** | Dừng lại, chờ thứ **ở NGOÀI** việc đang làm | bên ngoài quyết định | chờ khóa API, chờ duyệt, chờ hạ tầng, chờ dữ liệu người khác cấp |
| **done** | Code đã **gộp vào nhánh chính** (merge) | máy đọc Git xác nhận | PR merged, thấy trên `main` |
| **verified** | Đã **kiểm tra/test SAU KHI gộp** — chạy đúng như kỳ vọng | người/quy trình kiểm thử | test tay hoặc tự động chạy qua, không lỗi |
| **activated** | Đã **bật thật** — người dùng thật chạm được, tiền thật chảy qua | người có quyền quyết "bật" | cờ tính năng bật, go-live, nhận giao dịch thật |

`blocked` là **nhánh phụ** — không nằm trên trục chính, một việc có thể rơi vào `blocked` từ `wip` rồi quay lại `wip` khi hết chặn. 4 nấc còn lại (`plan → wip → done → verified → activated`) đi theo 1 chiều, không lùi.

## 3. Luật cấm nhảy tắt: `done` ≠ `verified` ≠ `activated`

Đây là chỗ hay bị lẫn nhất — và cũng là lỗi gây thiệt hại thật nhất (tính năng tưởng đã chạy, hóa ra cờ đang tắt; hoặc ngược lại, tưởng chưa chạy nên định làm lại từ đầu).

- **`done` (merge) KHÔNG có nghĩa là ai đó đã kiểm tra nó chạy đúng.** Code có thể merge sạch mà logic sai, hoặc merge xong chưa ai bấm thử.
- **`verified` (đã kiểm) KHÔNG có nghĩa là đã bật cho người dùng thật.** Rất nhiều tính năng verify xong trên môi trường thử vẫn nằm sau một cờ tắt — cố ý, chờ đúng thời điểm mới bật (ra mắt theo lịch, chờ mùa khuyến mãi, chờ đối tác sẵn sàng...).
- **Case thật hay gặp:** một nhóm tính năng đụng tiền/khuyến mãi được merge xong xuôi, nhưng cờ bật thật của nó vẫn TẮT vì còn chờ quyết định kinh doanh — nếu máy tự động đánh dấu "đã merge" = "activated", báo cáo sẽ nói dối rằng tính năng đang chạy thật trong khi khách chưa hề thấy nó.

**Vì vậy:** một công cụ đối soát (đọc Git thật — PR/commit đã merge) được phép **tự nhập FACT** (đã merge ngày nào, PR số mấy) và tự đẩy nấc `wip/blocked → done`. Nhưng **CẤM nó tự đẩy tiếp lên `verified` hay `activated`** — hai nấc đó là **phán đoán về Ý NGHĨA** ("đã kiểm chưa", "đã cho chạy thật chưa"), chỉ người (hoặc quy trình kiểm thử có kết quả rõ ràng) mới được chốt.

### Ví dụ 1 việc đi hết vòng đời

Việc "Bật thanh toán khi nhận hàng (COD)" cho một hệ bán hàng, đi qua đủ 6 nấc:

| Ngày | task-state | Chuyện gì xảy ra |
|---|---|---|
| 01/01 | `plan` | Ghi vào backlog, chưa ai đụng |
| 03/01 | `wip` | AI bắt đầu code trên nhánh riêng |
| 05/01 | `blocked` | Chờ đội vận hành chốt hạn mức COD tối đa/đơn |
| 09/01 | `wip` | Hạn mức đã chốt, code tiếp |
| 12/01 | `done` | PR merge vào nhánh chính (máy đọc Git thấy, tự bump) |
| 13/01 | `verified` | Test trên môi trường thử: đặt đơn giả, xác nhận đúng luồng |
| 20/01 | `activated` | Người chủ bấm bật cờ COD thật — khách bắt đầu thấy tùy chọn này |

Chú ý khoảng cách **12/01 → 20/01**: 8 ngày code đã nằm sẵn trên nhánh chính nhưng CHƯA bật — đây chính là khoảng mà nếu gộp `done` với `activated`, báo cáo sẽ nói sai "COD đang chạy" suốt 8 ngày đó.

## 4. Mỗi việc = 1 dòng checklist

Format gợi ý cho một dòng việc trong backlog dự án:

```
- [ ] Thêm màn hình đăng nhập — 👤 chủ · plan
- [ ] Nối cổng thanh toán — 🤖 AI · wip
- [ ] Bật khuyến mãi cuối năm — 👥 team · blocked (chờ: duyệt ngân sách)
- [x] Đồng bộ kho hàng — 🤖 AI · done · verify: pr=128 sha=a1b2c3d gate=none
- [x] Gửi email xác nhận đơn — 🤖 AI · verified · verify: pr=131 sha=9f0e211 gate=flag_email_confirm
```

3 phần bắt buộc trong mỗi dòng:

1. **Nội dung việc** — 1 câu ngắn, đủ hiểu không cần mở link.
2. **Chủ-việc** (ai đang giữ việc) — icon để liếc nhanh, không cần đọc chữ:
   - 👤 **chủ** — người có quyền quyết định cuối (đặc biệt cần cho nấc `activated`)
   - 👥 **team** — người/nhóm cụ thể ngoài AI
   - 🤖 **AI/trợ lý** — trợ lý AI tự làm
   - ⚙️ **hạ tầng/tự động** — chạy bởi quy trình/cron, không ai bấm tay
3. **task-state** (1 trong 6 nấc). Khi `blocked` → ghi kèm **chờ gì** (ngắn gọn, đủ để người khác biết cần làm gì để gỡ).

4. **`verify:`** (tùy chọn, thêm khi có) — 1 cụm máy-đọc-được neo việc vào bằng chứng thật:

```
verify: pr=<số PR> sha=<commit hash> gate=<tên-cổng|none>
```

- `pr` / `sha` = mỏ neo trỏ đúng vào Git — công cụ đối soát dùng nó để hỏi thẳng kho code "cái này có thật trên nhánh chính không, merge ngày nào".
- `gate=none` = không còn cổng nào chặn, có thể đẩy lên `activated` bất cứ lúc nào người chủ muốn.
- `gate=<tên>` = đã merge/verify nhưng còn 1 cổng cụ thể đang giữ nó lại (tên cờ tính năng, tên bước duyệt...) — công cụ đối soát thấy `gate` khác `none` thì **không được giục/tự bật**, chỉ báo "còn cổng X".

Không bắt buộc gắn `verify:` cho mọi việc — chỉ đáng làm với việc quan trọng, hay bị hỏi lại "cái này chạy thật chưa", hoặc với dự án đủ lớn để cần một công cụ đối soát tự động.

## 4b. ĐỐI SOÁT với Git (chống over-claim)

`verify:` ở mục 4 chỉ là chỗ NEO — tự nó không tự kiểm tra gì. Muốn biến neo đó thành một CỔNG SOÁT tự động, ghép thêm một công cụ đọc Git thật (ví dụ đặt tên `doi-soat.mjs`) để hỏi thẳng kho code: sha/PR ghi trong `verify:` có tồn tại không, đã merge vào nhánh chính chưa, merge ngày nào — rồi so với `task-state` đang khai trong backlog.

**Hai lỗi lệch mà đối soát bắt được:**
- **Khai `done`/`verified` nhưng git chưa thấy merge trên nhánh chính** → over-claim (nói xong mà chưa thật xong) — cờ 🔴, vì đây là lỗi nói sai nghiêm trọng hơn.
- **Git đã thấy merge từ lâu nhưng backlog vẫn ghi `wip`/`blocked`** → quên bump — cờ 🟡, nhắc rà lại.

Cả hai cờ đều **chỉ gợi ý, KHÔNG tự chặn hay tự đẩy trạng thái** — công cụ đối soát được phép tự nhập FACT (đã merge/chưa) và tự bump `wip/blocked → done`, nhưng vẫn CẤM nó tự đẩy tiếp lên `verified`/`activated` (đúng luật cấm-nhảy-tắt ở mục 3: merge ≠ đã-kiểm ≠ đã-bật-thật, hai nấc đó chỉ người mới được chốt).

**Git-optional — không có git thì bỏ qua êm:** không phải mọi kho đều có repo git để soát (một số dự án chỉ có tài liệu, không code). Công cụ đối soát nên tự phát hiện "không tìm thấy repo git liên quan" rồi im lặng bỏ qua bước này, KHÔNG báo lỗi/KHÔNG chặn — đối soát là lớp cộng thêm cho dự án có code, không phải điều kiện bắt buộc của máy 6 nấc.

**Heuristic văn xuôi — "nghi xong chưa bump" (dùng khi không có `verify:` hoặc không có git):** một dòng việc/mảnh có `task-state`/`status` là `wip` hoặc `blocked`, nhưng THÂN bài lại có dấu hiệu đã xong bằng lời (✅, "đã merge", "đã xong", "đã go-live"...) → cờ vàng nhắc rà lại, dù không đọc được git. Đây là lưới an toàn cho trường hợp việc thật đã xong nhưng quên sửa nhãn — lỗi hay gặp nhất khi phiên bị cắt ngang giữa lúc làm xong và lúc gõ cập nhật trạng thái (xem mẹo áp dụng ở mục 7: đổi task-state trong CÙNG một lần sửa với việc gõ "xong").

## 5. Bảng tổng hợp là VIEW TỰ IN, không chép tay

Khi backlog nhiều dự án, việc đọc từng file để đếm "còn bao nhiêu việc dở, cái nào bị chặn" tốn thời gian và dễ đếm sai. Cách đúng: viết **một script nhỏ** quét mọi dòng checklist (`- [ ] ... · <task-state>`) trong các file backlog, rồi in ra một bảng tổng hợp — ví dụ nhóm theo `blocked` (đang chờ gì, chờ ai), theo `wip` (ai đang cầm), theo việc để lâu không nhích nấc.

Nguyên tắc bắt buộc: **bảng tổng hợp đó CHỈ ĐƯỢC IN LẠI, không bao giờ là nơi sửa trạng thái tay.** Muốn đổi trạng thái một việc → sửa đúng dòng checklist ở backlog dự án → chạy lại script in. Nếu ai đó sửa thẳng vào bảng tổng hợp, lần in tiếp theo sẽ đè mất, và tệ hơn — sẽ có 2 nơi nói 2 trạng thái khác nhau cho cùng 1 việc.

## 6. Luật vàng SSOT (nhắc lại, áp cho tầng này)

> Mỗi dữ kiện hay-đổi chỉ ghi ở **MỘT** chỗ có thẩm quyền. Mọi báo cáo/bảng/mục lục khác đều là **bản in lại tự động** từ chỗ đó.

Áp cho task-state: chỗ có thẩm quyền = dòng checklist trong backlog dự án. Bảng tổng hợp toàn hệ, thông báo, báo cáo cuối tuần... tất cả chỉ là bản in lại. Nếu thấy 2 chỗ ghi 2 trạng thái khác nhau cho cùng 1 việc → luôn tin chỗ có thẩm quyền, đi sửa chỗ kia (hoặc sửa script in).

## 7. Mẹo áp dụng

- **Đừng bắt AI "nhớ" bump task-state ở cuối việc.** Nhắc kiểu "làm xong nhớ cập nhật trạng thái" hay bị bỏ quên khi phiên đứt/việc bị cắt ngang. Ràng buộc chắc hơn: đổi task-state **trong CÙNG một lần sửa** với việc gõ "xong" vào thân file — đừng tách 2 bước.
- **`blocked` khác `wip` bị bỏ bê.** Việc đang chờ thứ ngoài tầm (khóa, duyệt, hạ tầng) phải nằm ở `blocked`, không để trôi ở `wip` — nếu không, bảng tổng hợp sẽ trách nhầm "sao việc này làm lâu vậy" trong khi thực ra không ai đang code nó cả.
- **`activated` luôn cần một người ký tên.** Đừng để bất kỳ script nào tự đẩy việc lên `activated` — kể cả khi mọi tín hiệu kỹ thuật đều xanh. Bật thật là quyết định kinh doanh/vận hành, không phải quyết định kỹ thuật.
- **Việc để lâu ở 1 nấc mà không nhích** (nhất là `blocked`) là tín hiệu đáng lo hơn "còn nhiều việc `wip`" — bảng tổng hợp nên cờ riêng những việc đứng yên quá lâu, không gộp chung vào đếm số.
- **Di trú dần, đừng ép toàn bộ backlog cũ theo chuẩn 6 nấc cùng lúc.** Cứ để backlog cũ dùng nhãn cũ (chờ/đang-làm/chặn/done — xem `templates/BACKLOG.template.md`); áp máy 6 nấc cho việc MỚI hoặc việc đang bị hỏi lại nhiều lần "cái này chạy thật chưa".

## 8. Khi nào KHÔNG cần bộ máy này

Nếu dự án chỉ có vài việc, một người làm, không ai hỏi lại "cái này chạy thật chưa" — bảng ✅ xong / 🔄 đang làm / ⏳ chưa của `templates/tien-do.template.md` là đủ, đừng thêm tầng phức tạp. Máy 6 nấc đáng giá nhất khi: nhiều việc chạy song song, nhiều người/nhiều phiên AI cùng đụng, và có tiền/dữ liệu thật đứng sau lằn ranh "bật hay chưa bật".
