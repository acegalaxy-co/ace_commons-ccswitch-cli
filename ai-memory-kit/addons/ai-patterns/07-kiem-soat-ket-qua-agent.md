# 07 — Kiểm soát kết quả sub-agent: giao rõ → theo dõi trạng thái → nghiệm thu bằng chứng → điều phối chịu trách nhiệm cuối

🎯 **Vấn đề:** trợ lý AI điều phối tung nhiều sub-agent ("lính") chạy song song để làm nhanh/bao quát việc lớn (quét, rà soát, sửa hàng loạt). Nhưng **giao xong không kiểm = vô dụng hoặc nguy hiểm**: agent có thể chết giữa chừng, trả kết quả rỗng, lạc đề, hoặc tự đẻ thêm agent con ngoài kiểm soát — nếu điều phối coi "agent đã chạy" là "đã xong" thì lỗi nhân lên theo số agent, mất kiểm soát chất lượng lẫn chi phí.

## ✅ Cách làm

### 1. Giao việc rõ — mơ hồ vào thì rác ra
Mỗi agent nhận 3 thứ cụ thể, không được thiếu:
- **Mục tiêu**: làm gì, phạm vi tới đâu.
- **Tiêu chí đạt**: đo được, không chung chung ("rà kỹ" → cụ thể hoá thành danh sách điều kiện).
- **Định dạng kết quả**: cấu trúc trả về, để điều phối gộp/so sánh được ngay.

Khi giao việc **đọc/quét diện rộng**, chốt cứng vai trò ngay trong prompt mở đầu — đây là chỗ hay lạc vai nhất:

```
NHIỆM VỤ DUY NHẤT: đọc rồi TRẢ VỀ NGAY kết quả theo định dạng yêu cầu.
KHÔNG chờ agent khác. KHÔNG tự gọi thêm agent con.
Bạn là NGƯỜI LÀM, không phải điều phối.
```

*Case thực chiến:* một đợt quét diện rộng dùng nhiều chục agent đọc-only, 2 lỗi lạc-vai tốn token thật: (a) một agent trả lời "tôi sẽ chờ các agent khác hoàn tất" — tưởng mình là điều phối, không ra kết quả dù đã đọc xong file; (b) một agent khác **tự đẻ agent con** đi quét chồng lấn, khiến một phần việc bị quét lặp lại nhiều lần, chi phí đội gấp nhiều lần. Sau khi thêm đoạn chốt-vai ở trên vào đầu prompt, lần chạy lại đúng ngay.

### 2. Chọn số lượng agent chạy song song
- **Số agent = số mảnh việc ĐỘC LẬP** tách ra được từ việc lớn — không phải một con số tròn chọn theo cảm tính. Việc nhỏ/đơn giản → tự làm, đừng fan-out cho tốn.
- Việc có **thứ tự phụ thuộc** (B cần kết quả A) → không song song.
- Khi cho nhiều agent **sửa/ghi thật** song song: chia theo **phạm vi rời nhau** — mỗi agent sở hữu một cụm file/thư mục riêng, không ai đụng file của ai, loại xung đột ghi tận gốc. File/cấu hình **dùng chung** (header, thư viện, mục lục tổng...) điều phối tự giữ lại, gộp/sửa **sau khi** các agent xong — không giao phần dùng-chung cho agent.
- Việc lớn tốn nhiều tài nguyên: chủ động đề xuất số agent + chi phí ước chừng + cách chia, xin duyệt trước khi chạy.

| Người giao việc nói | Điều phối nên làm |
|---|---|
| "Làm kỹ / bao quát hết" | Nhiều agent hơn + thêm bước kiểm chéo (một agent làm, một agent verify độc lập) |
| "Làm nhanh gọn" | Ít agent hoặc tự làm luôn, không fan-out |
| Không nói rõ, việc nhỏ | Mặc định tự làm — fan-out chỉ khi việc thật sự tách được thành nhiều mảnh độc lập |

### 3. Theo dõi trạng thái — im lặng không có nghĩa là xong
- Chủ động bắt agent **chết / trả rỗng / im lặng / lạc đề**. Không mặc định "không báo lỗi nghĩa là đã xong".
- Theo dõi **id nhiệm vụ lạ** không khớp danh sách đã giao — dấu hiệu có agent tự đẻ lính con ngoài kiểm soát, cần chặn sớm trước khi chi phí đội lên.
- Agent treo hoặc lỗi → chạy lại hoặc chia nhỏ việc ra, không bỏ lặng coi như không có chuyện gì.

### 4. Nghiệm thu bằng CHỨNG, không tin lời agent tự khai
- Đối chiếu kết quả với tiêu chí đã giao ở bước 1.
- Verify bằng bằng chứng cụ thể: đọc lại file thật, chạy build/test, đối chiếu số liệu, chạy lệnh đếm xác định (`grep -c`, vòng lặp liệt kê...). "Agent báo đã xong" không phải bằng chứng.
- Kết quả **rà-soát/audit** của agent càng cần verify kỹ, vì agent loại đọc-nhanh thường đọc **trích đoạn** chứ không nuốt trọn nguồn → dễ báo nhầm khi khẳng định "thiếu/không có" (một ca thật: agent báo "phần lớn mục bị sót khỏi mục lục", verify lại bằng một lệnh đếm đơn giản thì thực ra 0 mục nào sót — agent chỉ tìm sai định dạng liên kết). Quy tắc: phát hiện **CÓ-mặt** (tìm thấy X) đáng tin hơn phát hiện **VẮNG-mặt** (không thấy X) — loại sau luôn phải verify lại bằng lệnh xác định trước khi hành động hàng loạt theo đó.
- Việc **hệ trọng / khó đảo ngược** (production, xoá dữ liệu, đụng tiền) → kiểm chéo độc lập, không dựa vào một nguồn duy nhất.

### 5. Điều phối chịu trách nhiệm cuối
- Kết quả của agent con là **đầu vào để kiểm**, không phải sản phẩm cuối. Điều phối gom, kiểm, sửa rồi mới báo lại cho người nhận việc.
- Không đổ lỗi "agent con làm sai" — điều phối là bên chọn giao việc, chọn cách chia, và chịu trách nhiệm nghiệm thu.
- Định nghĩa **"XONG" = đã-kiểm-VÀ-đạt**, không phải "agent đã chạy xong".

### 6. Chống-sót sau khi gộp kết quả song song
Sau khi nhiều agent làm xong và gộp lại: rà lại đường nối giữa các phần — liên kết ngược 2 chiều nếu có tài liệu gốc liên quan, và phần còn dang dở phải tách thành mục riêng để theo dõi tiếp, không lẫn chung với phần đã xong (lẫn vào là cách phổ biến nhất khiến việc dở bị quên).

### 7. Nghiệm thu bằng CHỨNG khi agent SỬA HÀNG LOẠT file text
Ca đặc biệt dễ tin nhầm "agent báo xong = xong": giao agent đổi 1 chuỗi text hàng loạt qua nhiều file bằng script (`perl -e`, `sed`...). Nếu chuỗi cần thay có ký tự ngoài-ASCII (vd tiếng Việt có dấu, hay ngôn ngữ non-Latin khác), rất dễ dính **double-encode (mojibake)**: công cụ decode/encode ĐÚNG nội dung file (đọc/ghi UTF-8), nhưng **KHÔNG decode chuỗi nằm ngay trong tham số dòng lệnh của script** (`-e '...'`) — bytes UTF-8 của chuỗi bị hiểu nhầm thành Latin-1 rồi encode UTF-8 lần nữa, ra chữ rác kiểu "riêng" → "riÃªng". Lỗi này khó thấy bằng mắt thường (terminal có thể tự render lại gần đúng) và file sau khi hỏng **vẫn là UTF-8 hợp lệ về mặt kỹ thuật** (công cụ decode thường vẫn pass) → agent tự báo "đã đổi xong N file" không phải là bằng chứng, dễ lọt lưới nếu điều phối tin luôn.

**Kỷ luật nghiệm thu bắt buộc** (áp cả khi agent nói "đã tự verify"):
- **Snapshot TRƯỚC khi đổi**, rồi **diff từng file đã sửa với snapshot**: đúng ra chỉ thấy đúng dòng/chuỗi đổi, không lệch byte nào khác ngoài dự kiến.
- **Decode nghiêm ngặt (strict)** từng file đã sửa, không chỉ tin "mở được là được":
  ```
  python3 -c "open('FILE', encoding='utf-8', errors='strict').read()"
  iconv -f utf-8 -t utf-8 FILE > /dev/null
  ```
  (Bước này chỉ xác nhận file là UTF-8 hợp lệ — mojibake do double-encode VẪN hợp lệ UTF-8 nên **không** tự bắt được mojibake; bắt buộc thêm bước soi bên dưới.)
- **Soi mojibake bằng regex đặc trưng** (dấu vết chữ riêng của double-encode UTF-8→Latin-1→UTF-8):
  ```
  grep -nE "Ã[^A-Z]|â€|Â[^A-Z ]" FILE...
  ```
  Trống = sạch. Có kết quả = mojibake, phải sửa lại (đổi cách làm — dùng công cụ sửa file đọc/ghi UTF-8 chuẩn thay vì script inline).
- File **phát ra ngoài** (tài liệu chia sẻ, repo công khai...): verify này **bắt buộc**, kể cả khi agent báo "đã kiểm rồi" — điều phối tự chạy lại, không tin báo cáo.

Phòng từ gốc: chuỗi thay **thuần ASCII** thì script inline (`perl -e`/`sed`) an toàn; chuỗi thay **có ký tự ngoài-ASCII** thì dùng công cụ sửa file trực tiếp (đọc/ghi UTF-8 chuẩn) hoặc đặt chuỗi trong **file script riêng** (không phải tham số `-e` inline) với encoding khai rõ ràng — đừng nhét thẳng chuỗi có dấu vào dòng lệnh.

## 📊 Đo
- Tỷ lệ agent bị bắt lỗi (chết/rỗng/lạc vai/lạc đề) trên tổng số agent tung ra — số này không cần bằng 0, nhưng phải được **phát hiện**, không lọt lưới.
- Số lần nghiệm thu phát hiện agent báo sai (nhất là kiểu "thiếu/không có" hoá ra không đúng) trước khi hành động hàng loạt theo báo cáo đó — mỗi lần bắt được là một sự cố tránh được.
- Chi phí (thời gian/tài nguyên) của phương án nhiều-agent so với làm tuần tự/thủ công, để biết mức fan-out có đáng hay không cho loại việc đó.

## 📋 Checklist
- [ ] Prompt giao việc có mục tiêu + tiêu chí đạt + định dạng kết quả rõ ràng
- [ ] Việc quét/đọc diện rộng có chốt cứng vai (người làm, không phải điều phối) + cấm tự đẻ agent con
- [ ] Số agent = số việc độc lập tách ra được, không phải số tròn cảm tính
- [ ] Agent sửa thật song song → chia phạm vi rời nhau, phần dùng-chung điều phối tự giữ
- [ ] Có cơ chế bắt agent chết/rỗng/lạc đề; theo dõi id lạ để bắt agent tự đẻ con
- [ ] Nghiệm thu bằng bằng chứng cụ thể (build/test/đọc lại/lệnh đếm), không tin lời tự khai
- [ ] Việc hệ trọng có kiểm chéo độc lập
- [ ] Sau khi gộp: rà chống-sót (liên kết ngược + tách phần còn dở) trước khi báo hoàn tất

## ⚠️ Cạm bẫy
- Tin "agent không báo lỗi = đã xong" → bỏ sót agent chết/treo mà không hay.
- Sửa hàng loạt theo báo cáo rà-soát của agent mà không tự verify → tạo sai sót mới dựa trên kết luận sai của agent (đặc biệt các khẳng định kiểu "thiếu/không có").
- Giao việc diện rộng mà không chốt vai → agent lạc vai thành điều phối, hoặc tự đẻ lính con quét chồng lấn, chi phí đội lên nhiều lần cho cùng một việc.
- Nhiều agent ghi cùng một file dùng chung → xung đột ghi, mất dữ liệu của nhau.

> Liên quan mật thiết với 08 — Chống tiêm lệnh qua sub-agent: bài này lo khâu "kiểm chất lượng/tiến độ", bài 08 lo khâu "kiểm an toàn" của cùng một luồng kết quả agent trả về.
