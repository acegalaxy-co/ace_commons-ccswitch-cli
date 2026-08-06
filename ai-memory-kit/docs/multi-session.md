# Điều phối ĐA-PHIÊN — nhiều phiên AI chạy song song trên cùng 1 kho

> Khi bạn mở **nhiều phiên AI cùng lúc** (nhiều cửa sổ, nhiều người, hoặc agent nền) trên cùng một kho code/bộ nhớ → chúng dễ giẫm chân: sửa trùng file, làm xong không báo nhau, đè mất việc. Giải bằng **QUY TẮC tự-nạp, KHÔNG cần phần mềm** — vì mọi phiên đều đọc file này TRƯỚC khi làm là đã tự ép tuân thủ.
>
> Bỏ qua trang này nếu bạn chỉ chạy 1 phiên tại một thời điểm.

## Nguồn sự thật = `Memories/_Backlog.md`
Một file backlog chung, mỗi việc 1 dòng: **trạng thái · phiên/nhánh · repo+vùng-file đang giữ · link PR · mảnh nhớ liên quan**. Xem mẫu `templates/BACKLOG.template.md`.

## 5 luật MỌI phiên PHẢI theo
1. **Đồng bộ trước khi làm (off nhánh gốc vừa fetch).** Việc ĐẦU TIÊN mỗi phiên: `git fetch` → so HEAD local vs nhánh gốc (origin) → nếu gốc mới hơn thì pull+merge về RỒI mới làm. Luôn tạo nhánh/worktree từ gốc vừa fetch. **Stale-base (làm trên bản chép cũ) là thủ phạm xung đột số 1.**
2. **1 việc = 1 nhánh/worktree riêng** (tách off nhánh gốc mới).
3. **NHẬN việc TRƯỚC khi làm.** Mở `_Backlog.md`: nếu việc/vùng-file đó đang `đang-làm` bởi phiên khác → NÉ hoặc đổi việc; nếu trống → ghi 1 dòng `đang-làm` (phiên/nhánh/vùng + giờ) rồi mới bắt tay. → chặn chồng chéo.
4. **XONG việc → BẮT BUỘC 3 thứ:** (a) đổi dòng backlog sang `done` + dán link PR; (b) **ghi kết quả vào (các) mảnh nhớ liên quan** + backlink `[[tên-mảnh]]` 2 chiều; (c) phát sinh việc mới → thêm dòng backlog mới.
5. **Giả định phiên có thể đứt** → cập nhật backlog + mảnh nhớ NGAY khi phát sinh, đừng đợi cuối phiên.

> "Báo cho nhau" chạy bằng chính hệ `[[wikilink]]` — không cần thông báo tự động: phiên làm-xong tự mở đúng mảnh nhớ để cập nhật + link; phiên sau đọc INDEX/`_Backlog.md` là thấy hết.

## 6 luật tăng cường (khi nhiều phiên thật sự đông)
6. **LEASE CÓ HẠN (TTL):** dòng `đang-làm` kèm **giờ bắt đầu/cập nhật**. Một việc `đang-làm` quá ngưỡng (vd >3h) không cập nhật → coi như **phiên chết** → phiên khác được giành lại. Diệt lỗi "phiên đứt giữ khoá mãi".
7. **CHẶN-BỞI (depends-on):** việc chờ việc khác → gắn `chặn-bởi: <việc>`; phiên khác BỎ QUA, không nhặt việc bị chặn.
8. **MERGE TUẦN TỰ + kiểm tra (CI) xanh trước merge:** KHÔNG merge 2 nhánh cùng lúc (tránh đụng tích hợp).
9. **SỞ HỮU VÙNG:** ai claim `repo+vùng-file` thì sở hữu vùng đó → phiên khác không đụng tới khi nhả.
10. **WIP = 1:** mỗi phiên giữ TỐI ĐA 1 việc `đang-làm` cùng lúc → không ôm nhiều việc bỏ dở, không khoá nhiều vùng.
11. **ĐỐI CHIẾU lúc khởi động/đứt-lại:** đầu phiên đọc `_Backlog.md` → dọn claim quá hạn của CHÍNH MÌNH + kiểm việc tưởng `done` đã merge thật chưa.

## Khoá file `.khoa-engine.lock` (chỉ chống CÙNG MÁY)
Các script ghi (`memory-doctor.mjs --fix`, `build-index.mjs --write`, `tien-do.mjs --write`, `so-nang-luc.mjs --write`, `ghi-manh.mjs`, `moi-so-nang-luc.mjs --write`) tự chiếm khoá `.khoa-engine.lock` ở gốc tủ trước khi ghi — chống 2 **phiên cùng máy** chạy song song đè ghi lẫn nhau (stale >10 phút tự phá; hết retry → fail-open, vẫn chạy tiếp). **KHÔNG bảo vệ 2 máy khác nhau** đồng bộ qua Drive/iCloud — sync không kịp thời gian thực nên khoá trên máy A vô hình với máy B. Đa-máy vẫn phải theo kỷ luật backlog/1-việc-1-người ở trên.

## Khi nào nâng lên CODE (đừng vội)
Chỉ khi thật sự **đua giành cùng việc trong tích tắc** mới cần khoá tự động — và **đừng dựng database**. Rẻ-mà-chắc: **"claim bằng git commit"** — đưa `_Backlog.md` vào 1 repo git; giành việc = commit+push dòng `đang-làm`, ai push trước thắng, kẻ thua pull→nhặt việc khác. Git = máy-khoá miễn phí.
> ⚠️ Nếu `_Backlog.md` nằm trên cloud-sync (iCloud/Drive) có rủi ro **mất-ghi** khi 2 phiên sửa cùng giây → giữ sửa NHỎ + đọc-lại-trước-khi-ghi; đụng thật thì chuyển sang claim-bằng-git.

## 🛑 DỪNG ở đây
11 luật trên phủ đủ cho một nhóm nhỏ nhiều-phiên. Thêm nữa (priority/size tag, nghi thức handoff, GC định kỳ, dashboard…) = **vẽ rắn thêm chân**. Giá trị thật nằm ở **TUÂN THỦ** + làm việc thật trong backlog, không phải polish quy trình.

---

# Bộ nhớ chung cho TEAM (nhiều người, 1 trợ lý AI)

> Trên đây là nhiều **phiên** giẫm chân trên cùng 1 kho. Chương này giải bài khác: nhiều **người** cùng dùng CHUNG một trợ lý AI, và cần một **bộ nhớ dùng-chung-được** — nhưng tủ ký ức gốc của người chủ lại **trộn cả phần riêng tư** (chiến lược, tài chính, secret, dữ liệu cá nhân) không thể bê nguyên cho người khác.

Bỏ qua chương này nếu chỉ có 1 người dùng tủ.

## Vấn đề: tủ gốc GIÀU nhưng RIÊNG
Tủ ký ức của người chủ thường là nơi giàu ngữ cảnh nhất: quyết định, lý do, bối cảnh nội bộ, số liệu nhạy cảm, tham chiếu secret, dữ liệu cá nhân. Đưa **nguyên xi** cho cả team = lộ ruột gan. Nhưng bỏ luôn không chia = mỗi người hỏi trợ lý phải kể lại ngữ cảnh từ đầu. → Cần **rút phần dùng-chung-được** mà **không rò phần riêng**.

## Kiến trúc 2 lớp (2 chiều, ĐỀU qua CỔNG)
Nguyên tắc lõi: **KHÔNG bao giờ auto-trộn 2 chiều.** Xuống mà auto = lộ data chủ; lên mà auto = rác + dữ liệu cá nhân của người khác (PII) làm bẩn tủ master.

| Tầng | Vai trò |
|---|---|
| **Máy/tủ chủ (master)** | Bộ nhớ đầy đủ + riêng tư — nguồn giàu nhất, **GIỮ NGUYÊN**, không ai ngoài chủ đọc thẳng |
| ⬇️ Đẩy xuống (**cổng RỬA + chủ duyệt**) | Lọc phần dùng-chung-được (quy ước · cách-dùng · taxonomy/tag · kiến thức nền), **BỎ** phần riêng/tài chính/secret/PII |
| **Lớp chung** (kho/bảng team) | Bản đã sạch — cả team đọc được (qua trợ lý AI có workspace chia sẻ) |
| ⬆️ Merge ngược | Người trong team ghi cái mới → **hộp "chờ duyệt"** ở phía chủ → chủ gật → mới nhập vào master |

Dựng 1 lần cho 1 dự án làm mẫu → nhân sang dự án khác (đổi kho + danh sách "được chia").

## 3 bước vòng đời
1. **Xuống:** máy chủ = master, đầy đủ + riêng tư, **giữ nguyên**. Chỉ phần generic-đã-rửa được đẩy xuống lớp chung, qua cổng rửa + chủ duyệt.
2. **Đọc:** team đọc lớp chung (chỉ phần đã sạch), không chạm master.
3. **Lên:** team ghi mới → vào **hộp "chờ duyệt"**, KHÔNG vào thẳng master. Chủ gật đầu từng mục → mới nhập.

## Cổng RỬA — chặn cả secret LẪN PII
- **Kho chứa bộ nhớ chung phải `deny-default`** (mặc-định-cấm; chỉ mở đúng người, đúng phạm vi — nếu dùng CSDL có phân quyền dòng thì bật quy tắc chặn-trước-cho-phép-sau).
- **Scrub 2 lằn:** chặn **secret** (khóa/token/mật khẩu/số tài khoản) **VÀ** chặn **PII** (thông tin nhận-dạng-cá-nhân: liên hệ khách, danh tính người…). Hai thứ này khác nhau — đừng chỉ lo secret mà quên PII.
- **Connector/AI KHÔNG hẳn là zero-retention:** nhiều kết nối trợ lý AI không cam kết "không lưu lại dữ liệu" → càng phải làm sạch TRƯỚC khi đẩy, đừng trông chờ phía kia không giữ.

## Onboard team: chung "nhà" + chung "bộ não"
Hai tầng độc lập:
- **Chung "nhà" (tài khoản):** mỗi người 1 ghế trong cùng một tổ chức/không-gian-làm-việc → ai cũng có công cụ; quản lý + chi phí gom về 1 mối.
- **Chung "bộ não" (ngữ cảnh):** một **workspace/Project chia sẻ** của trợ lý AI = **instructions** (persona + cách trả lời + lằn ranh) + **knowledge đã rửa** (tài liệu nền dùng chung). Chỉ ai được mời mới thấy.

### Cạm bẫy của Project/workspace chia sẻ
- **PHẲNG, KHÔNG kế thừa:** các Project thường không lồng nhau, không tự thừa hưởng ngữ cảnh từ "tầng trên" → muốn context chung (vd cách-làm-việc) thì phải **copy vào TỪNG nơi**, đừng tưởng nó tự lan.
- **1 chiều + không lịch sử:** chủ nạp vào; người khác chỉnh gì thường **không tự chảy ngược** về tủ chủ, và **không có nhật ký ai-sửa-gì / hoàn-tác**. → Không phải chỗ để team "làm việc nhịp nhàng, đồng bộ 2 chiều".
- **Muốn "nhà chung" SỐNG** (mọi người sửa, ai cũng thấy ngay, có lịch sử) → dùng **công cụ co-edit real-time** (kiểu tài liệu cộng tác trực tuyến như Notion) làm nguồn-sự-thật team cùng sửa; workspace AI chỉ giữ **instructions + đọc thẳng** nguồn sống đó cho khỏi cũ.
- **GIỮ tủ .md gốc của chủ RIÊNG:** tủ ký ức file-first vốn thiết kế **cho 1 người / đồng bộ giữa máy của chính chủ**. Đừng ép nó gánh vai co-edit nhiều người — đó là gốc gây rối. Chủ rút điều quan trọng từ nhà-chung về chốt vào tủ riêng.

## ⚖️ Bài học SCOPE — đừng phức-tạp-hóa ca đơn giản
Bộ lằn-ranh nhiều-lớp ở trên là để bảo vệ **tủ tổng đa-dự-án / đa-công-ty** của chủ. **ĐỪNG bê nguyên vào một ca ĐƠN GIẢN** = chia **1 dự án** cho **1 người tin cậy**.
- **Ca 1-dự-án + người tin cậy:** chia THẲNG mọi thứ của dự án đó; chỉ cần (1) không lọt **secret trần** + **dữ liệu dự án KHÁC**, (2) giữ không-gian ở chế độ **riêng tư** (chỉ mời). Hết.
- Với người chủ non-tech: cho **đường đơn giản, dứt khoát** ("còn 2 thao tác là xong"), đừng liệt kê 10 lưu ý hay mở thêm nhánh quyết định. Chủ hỏi lặp / khó chịu = tín hiệu bạn đang phức-tạp-hóa → rút gọn ngay.

---

# Resume đúng sau /clear + tự verify tiến độ

> Sau `/clear`, context = **rỗng**. Mọi thứ bạn "nhớ" giờ chỉ còn trong tủ ký ức trên đĩa. Chương này chống lỗi phổ biến nhất khi tiếp việc: **dựng lại hiện trạng SAI** rồi hành động/kết luận trên nền sai.

## Đọc mốc phiên MỚI NHẤT TRƯỚC — đừng dựng lại từ trí nhớ rỗng
Khi người chủ nói "tiếp <dự án>" / "chạy tiếp <việc>":
1. **Mở mốc phiên MỚI NHẤT của đúng mảng việc đó TRƯỚC** (liệt kê theo thời gian sửa, vd `ls -t`), nắm "phiên trước dừng ở đâu / bắt đầu tiếp từ đâu", **RỒI mới** hành động.
2. Đọc **backlog nhóm** + **`git log`/PR gần nhất** + **mốc phiên mới nhất** → dựng bức tranh **XONG / DỞ** trước khi mở miệng.

Lý do: context sau /clear = rỗng; mảnh rời + note phiên cũ dễ khiến AI dựng lại sai → nói ngược với việc **đã làm** = mất niềm tin + tốn thời gian đính chính.

## CẤM phán "thiếu / không có / bị chặn" khi chưa VERIFY
- Note phiên cũ = **"giả thuyết lúc đó", KHÔNG phải sự thật hiện tại**. Hệ tiến nhanh đa-phiên → cái note-cũ nói "chưa có" rất có thể **đã có** rồi.
- Mọi câu **"thiếu / không có / X từ đâu ra / bị chặn"** phải **ĐO** bằng data/code **LIVE** (truy vấn CSDL thật / grep code thật) rồi mới nói. Nghi ngờ chính note cũ.
- **Trước khi đề xuất/hỏi một việc → grep code thật xác nhận chưa-có.** Đừng hỏi việc **CÓ THỂ đã làm rồi** — hỏi việc đã-xong = lộ rõ "chưa đọc tiến độ".

## Tự verify được thì tự làm — đừng đẩy câu hỏi cho chủ
- Việc mà **data/code tự trả lời được** thì **tự đo, tự làm**, đừng biến nó thành câu hỏi cho người chủ. Chỉ hỏi dữ kiện **chỉ chủ mới biết** (ưu tiên kinh doanh · key · ngân sách).
- Khi "tiếp" mơ hồ: thay vì hỏi mù, **chốt 1 khuyến nghị dựa trên tiến độ THẬT**, rồi mới hỏi phần còn thiếu.
- **Chủ gắt / vặn lại = tín hiệu ĐANG ẨU** → DỪNG đoán, đi ĐO ngay.

---

# Khi nào /clear là vừa + đọc Drive khi thiếu connector

## /clear khi nào là VỪA
Điểm hay hiểu sai:
- **Context = trí nhớ tạm của phiên, CỘNG DỒN, không tự giảm.** Mỗi lượt, AI **đọc lại TOÀN BỘ** từ đầu phiên.
- Nên dù lượt sau chỉ sửa vài dòng, vẫn "đọc lại" cả đống đã tích → **vẫn hao**. Hao theo **TỔNG đã tích**, KHÔNG theo lượt. → "Làm ít mỗi lượt" KHÔNG cứu được; **chỉ `/clear`** (reset về ~0) mới cứu.
- **Quy tắc 1 câu:** `/clear` mỗi khi **XONG 1 CỤM VIỆC** (1 dự án / 1 task gọn). Không mất gì — vì trước khi clear đã **chốt mốc phiên** + bộ nhớ đã ghi → phiên mới **tự đọc lại** mốc + bộ nhớ rồi làm tiếp.

### Ngưỡng nêu theo **% cửa sổ ngữ cảnh** (đừng ghi token tuyệt đối)
Đừng chốt con số token tuyệt đối làm luật cứng — nó gắn với model cụ thể, đổi model là lỗi thời. Nêu theo **tỷ lệ cửa sổ ngữ cảnh**:

| Mức | % cửa sổ | Làm gì |
|---|---|---|
| 🟢 | < ~25% | Cứ làm thoải mái |
| 🟡 | ~25–40% | Xong cụm việc → chốt mốc + `/clear` |
| 🔴 | > ~40% | `/clear` ngay khi tới chỗ sạch |

> Nếu có thanh đồng-hồ token / hook tự nhắc, **đồng bộ ngưỡng ở 1 CHỖ** (cùng mốc vàng/đỏ) rồi tham chiếu — đổi thì đổi 1 nơi cho khỏi lệch.

## Đọc Drive khi thiếu connector (đường vòng độc-lập-account)
**Gotcha:** connector Drive của trợ lý AI thường **gắn theo TÀI KHOẢN / tổ chức, KHÔNG đi theo người**. Cắm Drive hồi dùng không-gian cá nhân → khi đổi sang không-gian team (hoặc ngược lại) thì `/mcp` **không thấy** Drive nữa (không-gian kia chưa bật connector đó).

**Đường vòng:** dùng một công cụ đọc Drive **độc-lập-account** (vd `rclone` với remote drive ở chế độ **chỉ-đọc**) để liệt kê/tải file — chạy bất kể đang ở không-gian nào. Token xác thực lưu **cục bộ trên máy** (KHÔNG vào bộ nhớ / KHÔNG vào Git — đây là secret).

**Cảnh báo quyền:** cấp cho một công cụ local quyền **đọc Drive** = việc **quyền-dữ-liệu** → phải được **người chủ đồng ý TRƯỚC**. Ưu tiên phạm vi **chỉ-đọc**. Khi connector có sẵn (đang ở đúng không-gian) thì cứ dùng connector cho gọn; công cụ độc-lập chỉ là **dự phòng + tải-hàng-loạt-về-máy**.
