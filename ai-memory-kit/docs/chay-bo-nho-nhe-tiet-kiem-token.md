# Chạy bộ nhớ NHẸ — tiết kiệm token mỗi phiên

**File này là gì:** hướng dẫn thực dụng để giữ chi phí token của trợ lý AI ở mức thấp khi dùng bộ khung tủ-ký-ức này lâu dài, nhiều dự án, nhiều phiên. Viết cho người vận hành đã đọc qua [`methodology.md`](methodology.md) — ở đây đi sâu riêng phần **token/hiệu năng**: token hao từ đâu, cách chẩn đoán đúng thủ phạm, và các đòn tiết kiệm theo thứ tự ưu tiên. Không đổi triết lý gốc (file-first, đọc phân tầng) — chỉ nói cách VẬN HÀNH nó cho rẻ.

## 1. Hiểu đúng gốc rễ: ngữ cảnh CỘNG DỒN, không tự giảm

Trong một phiên làm việc, cửa sổ ngữ cảnh (context) chỉ **lớn dần**, không tự nhỏ lại. Mỗi lượt hỏi/trả lời, mô hình phải "đọc lại" **toàn bộ** những gì đã tích lũy từ đầu phiên — kể cả khi lượt đó chỉ hỏi một câu nhỏ.

Hệ quả dễ bị hiểu sai: *"làm ít mỗi lượt sẽ đỡ tốn"* — **không đúng**. Chi phí một lượt tỷ lệ với **tổng ngữ cảnh đã tích**, không phải với việc làm trong lượt đó. Phiên càng dài mà không dọn, mỗi câu hỏi sau càng đắt hơn câu trước, dù nội dung câu hỏi y hệt nhau.

→ Chỉ có hai cách thật sự cứu được: **dọn ngữ cảnh** (thủ công hoặc tự động) và **không nạp thừa từ đầu** (đọc phân tầng — xem mục 3).

## 2. Ngộ nhận phổ biến: "kho nhiều mảnh = tốn nhiều token"

Sai. Mỗi lượt hỏi, trợ lý chỉ nạp: Tầng 0 (cố định, nhỏ) + đúng vài mảnh/mục lục liên quan đến câu hỏi đó. **Tổng số mảnh trong toàn kho gần như không ảnh hưởng chi phí một lượt hỏi** — miễn là kho có cấu trúc phân tầng đàng hoàng.

Thủ phạm thật là **một NHÓM hoặc MỘT MẢNH bị phình to** — tức là chi phí **mỗi-lần-truy-hồi** cao, không phải chi phí cố định mỗi phiên. Ví dụ thực tế thường gặp: một dự án có mục lục (index) dài tới vài chục nghìn từ, kèm một vài mảnh "bom" 40.000-90.000 từ nhét hết chi tiết kỹ thuật vào một file — mỗi lần trợ lý cần chạm tới dự án đó là gánh một cục token khổng lồ, dù Tầng 0 vẫn nhỏ gọn như thường.

Kết luận vận hành: đi tìm và xé những NHÓM/MẢNH phình, đừng đi cắt bớt Tầng 0 với hy vọng cứu được chi phí — hai chỗ đó không cùng nguyên nhân.

## 3. Đọc PHÂN TẦNG — nhẹ mặc định

Nguyên tắc cốt lõi (đã nói ở `methodology.md`, nhắc lại vì đây chính là đòn tiết kiệm token số 1):

1. **Tầng 0 — luôn nạp mỗi phiên:** sổ tay nguyên tắc + mục lục tổng toàn kho. Đây là chi phí **cố định**, trả mỗi lần mở phiên/mỗi lần dọn ngữ cảnh — nên **bắt buộc phải nhỏ**.
2. **Tầng 1 — khi vào một dự án/nhóm cụ thể:** mở mục lục (INDEX) của riêng nhóm đó.
3. **Tầng 2 — khi đụng một việc cụ thể:** mở đúng mảnh liên quan, **không** mở cả nhóm.
4. Chỉ "nạp hết toàn bộ kho" khi người dùng yêu cầu rõ ràng — đừng tự ý quét sâu mọi lần.

Nạp lazy kiểu này cho phép kho "dày" (hàng trăm mảnh) mà chi phí mỗi phiên vẫn thấp, vì phần lớn kho **không bao giờ được chạm tới** trong một phiên bình thường.

## 4. Giữ Tầng 0 GỌN — kỹ thuật nén khi phình

Tầng 0 có xu hướng phình dần theo thời gian vì thói quen tự nhiên: thay vì tách chi tiết ra mảnh riêng, người ta nhồi thẳng ví dụ/số liệu/diễn giải dài vào sổ tay hoặc mục lục tổng — vì "tiện, đang gõ ở đó". Sau vài tháng, file lẽ ra chỉ là mục lục biến thành một bài luận dài.

**Dấu hiệu cần nén:** Tầng 0 vượt quá vài nghìn từ, hoặc một dòng mục trong mục lục tổng dài hơn 2-3 câu.

**Cách nén:**
- Viết lại Tầng 0 thành **mục lục THUẦN**: mỗi ý = 1 dòng chỉ-thị-ngắn + link trỏ tới mảnh chứa chi tiết. Bỏ hẳn số liệu, ví dụ dài, diễn giải — những thứ đó đã (hoặc nên) nằm sẵn trong mảnh chi tiết.
- **Luật bất di bất dịch: được bỏ CHỮ, không được mất CON TRỎ.** Sau khi nén, đếm lại số lượng link/tham chiếu trước và sau — phải khớp (chỉ tăng do gộp thêm link mới, không bao giờ giảm). Nén mà làm rớt một tham chiếu nghĩa là kho mất khả năng tìm lại thông tin đó.
- Vì Tầng 0 nạp lại **mỗi phiên**, nén nó tiết kiệm nhân với số phiên — 1 lần nén tốt có thể cắt hàng chục nghìn token TÍCH LŨY qua nhiều tuần dùng, hiệu quả hơn nhiều so với nén một mảnh chỉ thỉnh thoảng mới bị mở.

## 5. LUẬT TRẦN — chặn phình ở nguồn

Đặt trần mềm (cảnh báo, không chặn cứng) cho ba cấp, kiểm tra định kỳ hoặc bằng công cụ tự động:

| Đối tượng | Trần gợi ý | Vượt trần thì làm gì |
|---|---|---|
| 1 mảnh | ~6.000 từ | Xé thành mảnh con theo đề mục + 1 "hub" mỏng trỏ 2 chiều tới các mảnh con |
| 1 mục lục (INDEX) của một nhóm | ~3.000 từ | Tách thành nhiều mục lục con theo miền chủ đề; mục lục gốc chỉ còn trỏ + 1 câu mỗi dòng |
| 1 nhóm/dự án | ~60 mảnh | Dựng mục lục 2 cấp (mục lục gốc → mục lục con theo miền → mảnh) |

Ngưỡng nên **cấu hình được** (biến môi trường hoặc file cấu hình), không hardcode — mỗi kho có đặc thù riêng, con số trên chỉ là điểm khởi đầu hợp lý.

Khi xé mảnh, **đừng xóa nội dung cũ** — đổi trạng thái mảnh gốc thành "đã thay thế/lưu trữ" và trỏ sang mảnh mới, để giữ lịch sử truy vết.

## 5b. TRẦN riêng cho TẦNG-0 (khác trần mảnh/INDEX/nhóm ở mục 5)

> Mục 5 đặt trần cho 3 đối tượng "**có tra mới tốn**" (mảnh, INDEX nhóm, nhóm). Tầng-0 (sổ tay nguyên tắc + mục lục tổng) không thuộc nhóm đó — nó nạp **NGUYÊN VẸN vào MỌI phiên**, dù phiên đó có đụng gì tới nó hay không. Phình 1 dòng ở Tầng-0 = thuế token nhân với **toàn bộ số phiên còn lại**, trong khi phình 1 mảnh thường chỉ tốn ở phiên có chạm đúng mảnh đó. → cần trần RIÊNG, chặt hơn, không gộp chung mục 5.

**Ước lượng byte → token (khỏi cần gọi API để đo thật):** tổng số byte của MỌI file nạp mặc định mỗi phiên (sổ tay + mục lục tổng + file khác gắn cờ "luôn nạp") ÷ ~2,5 ≈ số token. Hệ số 2,5 là xấp xỉ cho markdown/tiếng Việt thường gặp — hiệu chỉnh lại nếu ngôn ngữ/định dạng khác biệt nhiều.

**Hai ngưỡng, không phải một** (trần mục 5 chỉ có 1 mức cảnh báo mềm — Tầng-0 là chi phí không tránh được nên cần phân độ):

| Mức | Ý nghĩa | Việc phải làm |
|---|---|---|
| 🟡 Mềm | Bắt đầu phình, còn chịu được | Cảnh báo + lên kế hoạch nén (mục 4) |
| 🔴 Cứng | Thuế-mỗi-phiên đã đáng kể | Nhắc quyết liệt hơn — nén NGAY hoặc xin miễn trừ có lý do (dưới) |

Đặt số byte/token cụ thể cho 2 ngưỡng theo cửa sổ ngữ cảnh của model đang dùng — đừng hardcode một số chung cho mọi kho/mọi model.

**Miễn trừ 1-chạm, BẮT BUỘC ghi log lý do:** đôi khi phình tạm có lý do chính đáng (đang giữa một đợt việc lớn cần tham chiếu nhanh, chờ tới lượt dọn...). Đừng chặn cứng không cho làm gì, cũng đừng lặng lẽ bỏ qua cảnh báo — dùng 1 file đánh dấu miễn trừ, **dòng đầu = lý do bằng chữ**. Có file này → hạ 🔴 xuống 🟡; xoá file → cảnh báo trở lại nguyên mức. File miễn trừ nằm công khai trong kho — ai cũng thấy, không âm thầm phình mãi.

**Vì sao đáng làm riêng:** nén một mảnh thường chỉ lời ở phiên có chạm mảnh đó; nén Tầng-0 lời ở **MỌI phiên tương lai** kể từ lúc nén — cùng công sức, lợi ích nhân lớn hơn hẳn. Nếu kit có bác sĩ bộ nhớ (`memory-doctor.mjs` hay tương đương) chạy mỗi phiên, để nó tự tính byte→token và tự báo mức mỗi lần — đừng bắt người tự đo tay.

## 6. Khi nào mới cần công nghệ tìm-theo-nghĩa (vector/embedding)

Đừng quyết theo mốc "đủ N mảnh thì đổi công nghệ" — đó là chỉ số sai. Với kho cỡ vài trăm mảnh, đọc trực tiếp file + tra theo nghĩa bằng chính mô hình (không vector) vẫn chính xác ngang hoặc hơn; vector chỉ thắng về tốc độ/chi phí khi kho **cực lớn**.

Chỉ cân nhắc thêm lớp tìm-theo-nghĩa khi **cả hai** điều kiện sau đều đúng:
1. Đã xé mảnh/mục lục theo luật trần ở mục 5 **và** đã gắn thêm từ khóa/alias cho các mảnh hay bị tra trượt.
2. Vẫn đo được tỷ lệ tìm-đúng (recall) dưới ngưỡng chấp nhận (ví dụ <90%) trên một bộ câu hỏi kiểm thử.

Nếu buộc phải thêm, dùng nó **chỉ để chọn file ứng viên** — văn bản đọc-được vẫn là nguồn sự thật gốc (source of truth), không thay thế nó.

## 7. Chọn "vai" cho AI theo việc — tiết kiệm mà không hạ chất lượng

Trong một hệ có nhiều tác tử (agent) làm việc song song — một tác tử điều phối chính và một số tác tử phụ (sub-agent, "lính") được giao việc con — chi phí có thể tăng vọt nếu không kiểm soát:

- **Tác tử chính** (ra quyết định, việc lõi/khó, cần đúng ngay lần đầu) → dùng model mạnh nhất đang có.
- **Tác tử phụ** làm việc đọc-rộng/máy-móc/tổng-hợp-thô (quét nhiều file, gom dữ liệu) → dùng model rẻ hơn là hợp lý; tác tử chính sẽ **thẩm định lại** kết quả trước khi dùng, nên chất lượng đầu ra cuối cùng không giảm.
- **Bài học quan trọng — đừng ép CỨNG toàn cục:** nếu cấu hình "mọi tác tử phụ luôn dùng model rẻ" ở một chỗ áp dụng toàn hệ, nó sẽ đè cả những lần việc con thật ra rất khó — kết quả bị làm dở âm thầm mà không ai nhận ra ngay. Cách đúng: người điều phối (tác tử chính) **tự quyết model cho từng lần giao việc** theo độ khó cụ thể, hoặc chỉ ghim sẵn model rẻ cho những "vai" chuyên biệt đã biết chắc là việc nhẹ và lặp lại.
- Việc thật sự cần suy luận sâu → làm thẳng ở tác tử chính, đừng giao cho tác tử phụ rồi phải sửa lại.
- **1 phiên = 1 cụm việc.** Đừng ôm nhiều việc lớn không liên quan vào một phiên dài — vừa làm ngữ cảnh phình nhanh, vừa dễ bung quá nhiều tác tử phụ cùng lúc (mỗi tác tử phụ mang theo một cửa sổ ngữ cảnh riêng, cũng tốn token, không phải miễn phí).

## 8. Khi nào dọn ngữ cảnh (`/clear` hoặc tương đương)

Ngữ cảnh không tự giảm trong một phiên (trừ khi công cụ có tự động nén — xem mục 9). Gợi ý ngưỡng theo phần trăm cửa sổ tối đa:

| Mức | Ngưỡng (tham khảo) | Hành động |
|---|---|---|
| 🟢 Xanh | dưới ~25% cửa sổ | Cứ làm bình thường |
| 🟡 Vàng | ~25-40% | Xong cụm việc hiện tại thì chốt lại rồi dọn |
| 🔴 Đỏ | trên ~40% | Dọn ngay khi tới điểm dừng an toàn |

**Quy tắc một câu:** dọn ngữ cảnh khi **XONG một cụm việc**, không phải khi ngữ cảnh đầy mới hoảng loạn dọn giữa chừng.

**Để dọn mà không mất việc đang làm:** trước khi dọn, tự chốt lại một "mốc phiên" ngắn gọn — đang làm gì, đã quyết gì, bước kế tiếp là gì, file nào đang mở — lưu vào một ghi chú riêng (khác với kho kiến thức dài hạn). Phiên mới mở lên tự đọc mốc này trước rồi làm tiếp, coi như không đứt mạch. Đây là điều kiện để dọn ngữ cảnh trở thành việc AN TOÀN thay vì đáng sợ.

## 9. Ưu tiên TỰ ĐỘNG hơn NHẮC TAY — bài học thật từ thực tế vận hành

Một mô hình vận hành hay gặp: dựng một lớp "nhắc" — hiển thị mức dùng ngữ cảnh hiện tại, cảnh báo màu khi tới ngưỡng, nhắc người tự gõ lệnh dọn. Vấn đề: lớp này **CHỈ NHẮC, không tự LÀM gì** — người vẫn phải nhớ để bấm, và trong thực tế hay quên hoặc bỏ qua vì đang bận việc chính. Nhắc mà không hành động thì hiệu quả tiết kiệm gần như bằng không.

**Bài học rút ra:** nếu công cụ/nền tảng đang dùng có sẵn cơ chế **tự động** nén hoặc rút gọn ngữ cảnh khi chạm ngưỡng (không cần người bấm), ưu tiên BẬT cơ chế đó lên trước, rồi mới cân nhắc có cần giữ thêm lớp nhắc-tay hay không. Tự động luôn thắng nhắc-tay về mặt hiệu quả thực đo — vì nó không phụ thuộc trí nhớ con người.

Vài lưu ý khi chuyển sang tự động:
- Đặt ngưỡng kích hoạt nén **sớm hơn** mức tối đa của cửa sổ (ví dụ nén khi chạm ~20% cửa sổ tối đa thay vì đợi gần đầy) — nén sớm hơn thì mỗi lượt "cõng" ít ngữ cảnh cũ hơn.
- Tự động nén là giảm hao ở khâu "đọc lại ngữ cảnh", **không phải lý do để hạ chất lượng model** cho việc quan trọng — hai việc độc lập, đừng gộp chung quyết định.
- **Đo trước/sau bằng số liệu thật:** chạy một khoảng thời gian đủ dài (ví dụ 1 tuần) trước khi bật, ghi lại mức dùng; bật lên, chạy thêm một khoảng tương đương; so sánh hai con số thật thay vì chỉ tin vào lý thuyết "chắc sẽ rẻ hơn".
- Đừng vội xóa lớp nhắc-tay/hạ tầng cũ ngay khi chuyển — để nó "nằm im" một thời gian phòng trường hợp cần quay lại, dọn hẳn sau khi đã xác nhận tự động ổn định.

## 10. Chẩn đoán nhanh: hao token thường đến từ đâu

Khi thấy chi phí một hệ trợ lý AI tăng bất thường, kiểm theo thứ tự khả năng cao trước:

1. **Phiên chạy quá dài không dọn** — chỉ liên tục nén nhẹ rồi chạy tiếp, ngữ cảnh trôi dần lên gần mức tối đa → mỗi lượt sau càng đắt hơn lượt trước dù nội dung hỏi giống nhau (mục 1).
2. **Một vài nhóm/mảnh phình to** bị chạm tới thường xuyên (mục 2, 5) — không phải do tổng số mảnh trong kho.
3. **Bung quá nhiều tác tử phụ cùng lúc** mà không kiểm soát số lượng — mỗi tác tử phụ nhân thêm một cửa sổ ngữ cảnh riêng, cộng dồn nhanh nếu không có giới hạn (mục 7).
4. Hiếm khi là do **chọn sai model** — chi phí đọc-lại-ngữ-cảnh (do #1 và #2) thường chiếm tỷ trọng lớn hơn nhiều so với chênh lệch giá giữa các model.

→ Hai đòn tiết kiệm ăn chắc nhất theo đúng thứ tự ưu tiên: **(1) dọn ngữ cảnh đúng lúc/tự động** và **(2) xé nhóm/mảnh phình theo luật trần** — làm trước khi nghĩ tới đổi model hay thêm công nghệ mới.

## Checklist cấu hình nhanh

- [ ] Tầng 0 (sổ tay + mục lục tổng) có đang vượt quá vài nghìn từ không? Nếu có → nén theo mục 4.
- [ ] Đã ước lượng byte→token của Tầng 0 chưa? Có đang chạm ngưỡng cứng 🔴 mà chưa nén/xin miễn trừ không? (mục 5b)
- [ ] Có nhóm/mảnh nào đang vượt luật trần (mục 5) mà chưa xé không?
- [ ] Model cho tác tử phụ có đang bị ép cứng một loại cho MỌI việc, kể cả việc khó, không? (mục 7)
- [ ] Công cụ đang dùng có tính năng tự-động nén ngữ cảnh chưa được bật không? (mục 9)
- [ ] Có quy ước "chốt mốc phiên trước khi dọn ngữ cảnh" chưa, để dọn không sợ mất việc đang làm? (mục 8)
- [ ] Đã đo mức dùng token trước/sau mỗi thay đổi lớn, hay chỉ đang tin theo lý thuyết?

---

Liên quan: [`methodology.md`](methodology.md) (triết lý gốc + luật trần đầy đủ) · [`do-recall-thu-thu.md`](do-recall-thu-thu.md) (đo recall trước khi cân nhắc vector) · [`multi-session.md`](multi-session.md) (nhiều phiên song song cũng ảnh hưởng tổng chi phí).
