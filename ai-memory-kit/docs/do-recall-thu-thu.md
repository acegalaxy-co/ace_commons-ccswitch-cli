# Đo RECALL thủ thư — bộ tra-cứu có SÓT mảnh không? (v3.6)

> **Vấn đề:** tủ phình dần, nhóm to dần → "thủ thư" (cách tra-theo-nghĩa: AI lùng cả thư viện rồi trả mảnh liên quan) bắt đầu **SÓT** mảnh mà bạn không hề biết. Cảm tính "hình như vẫn ổn" không đủ.
>
> **Cách giải:** biến nó thành **1 con số chạy-lại-được** = `Recall@K`. Đo baseline → xé nhóm to / thêm `aliases:` → **đo lại bằng số** (đỡ hơn hay tệ hơn). Không mò.

## Recall@K là gì
Bạn có một bộ **~18 câu hỏi** (viết bằng tiếng người dùng thật) + mỗi câu 1 **mảnh-vàng** (đáp án đúng nên trồi lên). Hỏi thủ thư từng câu, lấy **≤K kết quả đầu** (mặc định K=8). 

> **Recall@8** = (số câu mà mảnh-vàng nằm trong 8 kết quả đầu) ÷ (tổng số câu).

| Recall@8 | Ý nghĩa | Làm gì |
|---|---|---|
| 🟢 ≥ 92% | Tốt | Giữ; đo lại định kỳ |
| 🟡 80–92% | Tạm | Vá cấu trúc (xé mảnh/nhóm to, thêm alias) |
| 🔴 < 80% | Sót nhiều | Phải xé nhóm to / thêm `aliases:` / (cuối cùng) cân vector |

## 4 LOẠI BẪY phải nhồi vào bộ câu hỏi
Đây là đúng chỗ tra-cứu-theo-nghĩa hay gãy — thiếu chúng thì điểm đẹp GIẢ:
1. **lệch-từ** — người hỏi dùng TỪ KHÁC với từ trong mảnh (hỏi "tiền số" mà mảnh ghi "điểm thưởng/xu"). Bắt thiếu `aliases:`.
2. **cross-group** — mảnh nằm ở NHÓM KHÁC, từ hiếm, ít khi tra tới.
3. **nhóm-to** — nhiều mảnh cùng từ-khoá → thủ thư trả sai THỨ TỰ (precision thấp).
4. **đối-chứng-dương** — câu khớp đúng từ mảnh (kiểm baseline, phải trúng).

## Làm theo 4 bước
```bash
# 1) Tạo bộ eval + mẫu kết quả trong Memories/_eval/ (KHÔNG bị ghi đè khi nâng cấp kit)
node tools/eval-recall.mjs --init

# 2) Sửa Memories/_eval/recall-eval.json: viết ~18 câu của BẠN + mảnh-vàng + loại bẫy (đủ 4 loại).

# 3) Hỏi trợ lý AI từng câu ("những mảnh nào liên quan tới …?"), chép tên mảnh nó trả về
#    vào Memories/_eval/recall-results.json   →  { "q1": ["ten-manh-a","ten-manh-vang"], ... }

# 4) Chấm điểm:
node tools/eval-recall.mjs
```

## Khi có câu SÓT
Script in ra câu nào trượt + mảnh-vàng của nó. Soi nguyên nhân rồi **vá đúng gốc**:
- Mảnh-vàng thiếu **`aliases:`** (người hỏi bằng từ khác) → thêm alias vào frontmatter mảnh.
- Mảnh nằm trong **nhóm/INDEX quá to** (vượt LUẬT TRẦN — xem `methodology.md`) → xé sub-INDEX theo miền / xé mảnh con + hub.
- Tên/đề mảnh mơ hồ → đặt lại cho rõ.

Vá xong → chạy lại bước 4, xem con số **cải thiện thật**. Gắn việc đo này vào đợt **dọn tủ định kỳ** để bắt suy giảm theo thời gian khi nhóm tiếp tục phình.

> 📌 **Đây là cổng quyết định "có cần vector/RAG chưa".** Chừng nào còn xé-được + thêm-alias-được mà recall lên lại ≥90% thì **chưa cần** vector. Chỉ khi xé + alias rồi mà recall vẫn <90% mới phủ lớp embedding cho bước chọn-file (markdown vẫn là SSOT).

## TRA 2 BƯỚC qua mục lục phẳng — rẻ hơn tra-toàn-thân khi kho đã lớn

Đo Recall (trên) trả lời "có sót mảnh không". Câu hỏi thứ hai, cùng gốc: "tra một câu tốn bao nhiêu token?" — vì cách "thủ thư" (subagent tra theo nghĩa, xem `methodology.md`) tìm mảnh mặc định là **grep TOÀN THÂN**: quét hết nội dung mọi mảnh trong kho rồi mới chọn ra vài mảnh liên quan. Cách này ổn khi kho còn vài chục/trăm mảnh, nhưng phình tuyến tính theo (số mảnh × độ dài mỗi mảnh) — kho dùng lâu, nhiều dự án dễ vượt **nghìn mảnh**, và một câu hỏi bình thường (nhiều từ khoá chung) có thể khớp mờ-mờ với gần HẾT số đó.

**Đo thật một lần** trên một kho cỡ ~1000 mảnh cho thấy mức độ nghiêm trọng: 1 câu hỏi bình thường khớp mờ ~970/1035 mảnh khi grep toàn thân — quét ra khoảng 8-9 MB nội dung, tương đương **70-150 nghìn token cho MỖI câu hỏi**, dù Tầng 0 vẫn gọn như thường (đây chính là lý do phải nghi TRA CỨU trước, đừng vội đổ lỗi Tầng 0 phình — xem `chay-bo-nho-nhe-tiet-kiem-token.md`). Recall đo được cũng tệ tương ứng: Recall@8 chỉ 41%, Recall@1 chỉ 7% — quét nhiều mà vẫn dễ sót, vì mảnh đúng bị chìm giữa hàng trăm mảnh khớp mờ.

### Cách chữa: KHÔNG bỏ thủ thư — đổi thành tra 2 BƯỚC
1. **Bước 1 — grep MỤC LỤC PHẲNG trước.** Một file máy-sinh, **1 dòng = 1 mảnh**, đủ 4 trường: tên · status · mô tả ngắn (+ alias nếu có) · đường dẫn (path). File này nhẹ hơn body hàng chục lần vì mỗi mảnh chỉ đóng góp một dòng vài chục từ, thay vì toàn bộ nội dung.
2. **Bước 2 — mở ĐÍCH DANH path** của (những) mảnh khớp ở bước 1, đọc thẳng nội dung đầy đủ ở đó.
3. Chỉ quay lại **quét toàn thân** (kiểu lưới-vét) khi mục lục còn quá MỎNG để tin cậy — ví dụ kho nhỏ (vài chục/trăm mảnh) hoặc bước 1 ra 0 kết quả vì mảnh thật đang thiếu alias đúng nghĩa.

Đo lại cùng bộ câu hỏi sau khi đổi sang tra 2 bước, trên kho ví dụ trên: Recall@8 41%→**100%**, Recall@1 7%→**74%**, MRR 0,19→**0,85**, khối lượng phải grep mỗi câu chỉ còn 1 file mục lục vài trăm KB — **nhẹ hơn khoảng 25-30 lần** so với quét toàn thân. Số cụ thể sẽ khác theo từng kho, nhưng độ chênh lệch cỡ hàng chục lần là điển hình, vì bản chất mục lục luôn nhỏ hơn body nhiều bậc.

### `canonical: true` — tín hiệu ưu tiên khi tra
Thêm trường tuỳ chọn **`canonical: true`** vào frontmatter của các mảnh **gốc/chuẩn** (nguyên tắc nền, chuẩn kỹ thuật hay bị tra tới) — khác với mảnh **nhật ký** (ghi lại một sự kiện/quyết định một lần rồi thôi). Khi thủ thư tra ra nhiều mảnh khớp ngang nhau, mảnh có `canonical: true` được ưu tiên xếp hạng lên trên — người hỏi thường muốn "bản chuẩn hiện hành" hơn là "một lần nhắc tới nó trong nhật ký". Gắn CÓ CHỌN LỌC cho một số ít mảnh lõi hay bị tra — gắn tràn lan cho mọi mảnh làm tín hiệu mất tác dụng (không còn gì để ưu tiên hơn gì).

### Công cụ sinh mục lục
Mục lục phẳng nên do MÁY sinh, không gõ tay (dễ quên cập nhật khi thêm/sửa/xoá mảnh). Dùng một công cụ quét toàn kho, đọc frontmatter mỗi mảnh, in ra 1 dòng/mảnh (`build-catalog.mjs` là ví dụ tên gọi cho công cụ dạng này) — chạy lại mỗi khi kho đổi, hoặc tự tươi mỗi phiên nếu ghép vào bác sĩ bộ nhớ (`memory-doctor.mjs`) sẵn có. Đây là cách biến "tra cứu" từ một thao tác chỉ-hỏi-AI-và-tin thành một khâu **ĐO ĐƯỢC + TRA RẺ** — cùng tinh thần với đo Recall ở trên: đừng tin cảm tính, đo bằng số.
