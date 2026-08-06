# Phương pháp — Tủ bộ nhớ AI (file-first, không cần vector DB)

Bộ khung này biến trí nhớ của một trợ lý AI thành **các file markdown đọc-được**, có kỷ luật, tự kiểm tra. Triết lý gốc: *đọc NHANH, ghi CHẬM* — làm nặng lúc GHI (cấu trúc chuẩn) để lúc ĐỌC luôn nhẹ và đúng.

## Vì sao file-first, KHÔNG vector DB
SOTA 2026 (Mem0/Letta/Zep/ByteRover + hướng Anthropic): với kho **vài trăm mảnh**, "đọc thẳng file + tra theo nghĩa bằng chính mô hình" **chính xác bằng hoặc hơn** hệ vector; vector chỉ thắng tốc độ/chi phí khi kho **cực lớn**. → Giữ markdown làm gốc; chỉ phủ thêm lớp tìm-theo-nghĩa (embedding) khi **đo được recall tụt** dù đã xé + thêm alias (xem mục "Chi phí token" dưới + `do-recall-thu-thu.md`), KHÔNG theo mốc "đủ N mảnh thì đổi". File đọc-được = không lệ thuộc công nghệ, ai cũng kiểm được.

## Vòng đời 1 phiên làm việc
1. **ĐỌC PHÂN TẦNG** (nhẹ mặc định): Tầng 0 (sổ tay + MEMORY.md) → Tầng 1 (INDEX nhóm khi vào dự án) → Tầng 2 (mảnh đúng việc). Nói "nạp hết" mới nuốt tất cả.
2. **Đầu phiên chạy bác sĩ:** `node tools/memory-doctor.mjs --fix` — **tự vá** nhãn `status`/`updated` thiếu + mảnh mồ côi + INDEX lệch, bắt link gãy/rác (gợi ý tên gần đúng), **chụp lịch sử ra git mirror ngoài cây bộ nhớ**, và **in lại 2 bảng**: `TIEN-DO.md` (tiến độ toàn hệ) + `SO-NANG-LUC.md` (sổ năng lực).
3. **Làm việc.** (Nhiều phiên song song? Xem `multi-session.md` trước.)
4. **GHI NGAY khi phát sinh** (giả định phiên có thể đứt): lưu vào **MẢNH NHỎ (1 mảnh = 1 ý)** đúng nhóm; nguyên tắc bền → chắt lên sổ tay Tầng 0.

## 4 trụ cột

### 1) Đọc phân tầng (Core vs Archival)
Chỉ Tầng 0 nạp mặc định → mỗi phiên nhẹ. **Giữ Tầng 0 GỌN**: chi tiết tra-cứu đẩy xuống mảnh nạp-khi-cần, đừng để sổ tay phình.

### 2) SSOT — chống "lệch tầng"
Mỗi dữ kiện hay-đổi (nhất là **trạng thái**) chỉ ghi MỘT chỗ có thẩm quyền = **frontmatter `status:` của mảnh**. INDEX nhóm = **báo cáo TỰ IN** từ frontmatter (chạy `build-index.mjs`), KHÔNG chép trạng thái bằng tay. Mục lục tổng chỉ giữ mô tả tĩnh. → Không bao giờ "tầng trên nói xong, tầng dưới đang làm".

Từ vựng `status`: `live · wip · blocked · plan · research · maintain · done · reference · archived` (+ `updated: YYYY-MM-DD`). Mảnh chết → `archived`, **KHÔNG xoá** (giữ vết). Bảng nghĩa từng nhãn ở [Phụ lục A](#phụ-lục-a--bảng-nghĩa-status-ai-tự-gán) — **AI tự gán, đừng bắt người chủ chọn**.

### 3) Versioning 3-2-1 (không `.bak` tay)
- **Lớp 1:** git mirror cục bộ NGOÀI cây bộ nhớ (`memory-doctor` tự commit mỗi phiên) — "máy thời gian", `git log` lùi được.
- **Lớp 2:** snapshot FIFO (`snapshot.sh`, giữ N bản).
- **Lớp 3:** off-site (cloud cá nhân / ổ ngoài).
- Cần "ảnh" trước khi sửa mạnh → chạy snapshot, đừng tạo `.bak` tay (doctor sẽ coi `.bak/.old` là rác).
- **Hàng rào secret:** mirror DỪNG nếu phát hiện secret trần trong cây bộ nhớ (đừng nhân secret ra git).

### 4) Tra theo NGHĨA + Dọn theo NGHĨA
- **Thủ thư (librarian):** khi không chắc mảnh nào liên quan / cần "đã từng quyết gì về X" → để 1 sub-agent đọc-hiểu lùng cả thư viện rồi trả mảnh đã cô đọng (thay vì đọc tràn). Không cần vector.
- **Dọn tủ định kỳ:** máy QUÉT theo nghĩa (trùng/mâu thuẫn/nhầm nhóm/vụn-nên-đúc) → tờ trình 🟢🟡🔴 → **người DUYỆT** → mới sửa. Việc vô hại máy tự làm; việc mất ngữ cảnh (gộp/xoá) thì chờ người. `cleanup-nudge.mjs` tự nhắc khi tủ tích +N mảnh hoặc quá D ngày (kèm nhắc **đúc kết** khi 1 nhóm tích nhiều mảnh mới).

### 5) HỌC CHÉO — tái dùng trước khi dựng lại (v3)
Tủ không chỉ NHỚ mà còn **dạy lại chính nó**: gắn `capability:`+`do-tin:` cho mảnh "bản tốt nhất" → `SO-NANG-LUC.md` tự in bảng "năng lực → bản chuẩn ở đâu". TRƯỚC việc lặp-được, liếc Sổ → tái dùng bản `do-tin: cao`, đừng làm lại từ đầu. Đầy đủ: [`hoc-cheo-tu-bao-tri.md`](hoc-cheo-tu-bao-tri.md).

## Chi phí token đến từ đâu — LUẬT TRẦN chống phình
Một hiểu lầm phổ biến: "kho càng nhiều mảnh càng tốn token mỗi lần hỏi". SAI. Mỗi lượt hỏi, AI nạp **Tầng-0 + đúng vài mảnh/INDEX liên quan** — nên:
- **Tầng-0 + mục lục tổng = RẺ** (nhỏ, ổn định → được cache). Tổng số mảnh toàn kho gần như KHÔNG ảnh hưởng chi phí 1 lượt.
- **Thủ phạm = NHÓM / MẢNH bị PHÌNH** (token-mỗi-lần-tra): 1 mảnh 60.000 từ hay 1 INDEX nhóm 25.000 từ → mỗi lần đụng tới là tốn.

→ **LUẬT TRẦN (mềm, bác sĩ mục ⑨ tự canh, cảnh báo 🟡 không chặn):**

| Đối tượng | Trần gợi ý | Vượt thì làm gì |
|---|---|---|
| 1 mảnh | ~6.000 từ | **Xé mảnh con + 1 hub mỏng** trỏ 2 chiều (ranh theo đề mục/ngữ cảnh, đừng xé vụn mất mạch) |
| 1 INDEX nhóm | ~3.000 từ | Tách **sub-INDEX theo miền** (`_idx-<miền>.md`); INDEX gốc chỉ trỏ + banner định hướng; mỗi dòng = 1 link + 1 câu ≤25 từ |
| 1 nhóm | ~60 mảnh | Dựng **sub-INDEX 2 cấp** (chia theo miền) |

Chỉnh trần qua env: `MEMORY_MAX_WORDS_PIECE` / `MEMORY_MAX_WORDS_INDEX` / `MEMORY_MAX_PIECES_GROUP`.

**Khi nào mới cần vector/RAG?** Không theo mốc "đủ N mảnh". Chỉ khi đã **xé sub-INDEX + thêm `aliases:`** mà **recall đo được vẫn <90%** (đo bằng `docs/do-recall-thu-thu.md`), HOẶC có ≥2 nhóm quá lớn khiến cả sub-INDEX cũng phình. Khi đó embedding **chỉ dùng cho bước CHỌN-FILE**, markdown vẫn là SSOT. **Obsidian / graph** chỉ là kính-lúp cho NGƯỜI nhìn liên kết, KHÔNG phải cơ chế AI dùng — chưa cần graph DB.

## Tự-kiểm + tự-bảo-trì (đừng nhầm vai)
| Công cụ | Bắt / làm gì |
|---|---|
| `memory-doctor.mjs` | lỗi **CƠ HỌC** (nhãn thiếu, mồ côi, INDEX lệch, link gãy, rác) — **máy TỰ VÁ** khi `--fix`; còn in lại 2 bảng |
| `memory-autofix.mjs` (Stop) | chạy bác sĩ cuối mỗi lượt (van 90s) → lỗi cơ học **không dồn quá 1 lượt** |
| `ghi-manh.mjs` | tạo mảnh **đúng chuẩn từ lúc sinh** (chặn lỗi tại gốc) |
| Dọn tủ theo nghĩa | lỗi **THEO NGHĨA** (2 mảnh cùng việc, mâu thuẫn, nhầm nhóm) — máy đề xuất, người duyệt |
| `handbook-gate.mjs` | chặn sửa bộ nhớ khi phiên **chưa đọc Tầng 0** (chống lặp lỗi; không chặn nhầm sub-agent) |
| `pre-work-nudge.mjs` + `so-nang-luc.mjs` | **HỌC CHÉO**: nhắc tra Sổ Năng Lực + in Sổ để tái dùng bản tốt nhất |

---

## Ghi gì / bỏ gì — luật lọc + loại ký ức

### Luật lọc (cửa VÀO)
**GIỮ:** quyết định + lý do · yêu cầu/mục tiêu mới · kết quả/xác nhận xong việc · bài học/lỗi + cách xử · cách-làm-việc & sở thích của người chủ · sự thật bền (cấu hình/quy ước/ai-phụ-trách) · số liệu quan trọng từng kỳ.
**BỎ:** tán gẫu/xã giao · bước nháp đã bị thay · thông tin tạm trong phiên · trùng cái đã có · suy đoán chưa xác nhận.
**Tiêu chí vàng:** *bản chất canh cửa VÀO, đồng hồ canh cửa RA* — GIỮ/BỎ đo bằng **bản chất** (sự thật bền → giữ mãi; bước làm tạm → bỏ), KHÔNG dùng mốc thời gian. Cái đã giữ nhưng CÓ HẠN dùng → dán nhãn hết hạn ("tạm — bỏ sau khi xong X" / "rà lại sau N tháng") để khâu dọn quên đúng lúc.

### 4 loại ký ức (gắn thêm khi ghi)
- 🧱 **Sự thật bền (semantic):** quyết định/cấu hình/quan hệ → mảnh thường.
- 📔 **Nhật ký sự kiện (episodic):** việc/số-liệu theo dòng thời gian → file `nhat-ky.md` riêng của nhóm ("ngày X → Y"), phục vụ nhìn xu hướng. **Số liệu theo kỳ bắt buộc ghi kỳ.**
- 📐 **Quy trình/luật (procedural):** cách-làm-chuẩn (như chính trang này) gom ở `_Common/` để tái dùng.
- ⚡ **Phiên hiện tại (working):** KHÔNG lưu, chỉ sống trong phiên.

### Mốc thời gian (chống "sự thật hết hạn")
Mỗi sự thật/số liệu ghi kèm **"đúng từ [ngày]"**. Khi một sự thật bị thay → **đánh dấu cái cũ "đã thay [ngày]", KHÔNG xoá** (giữ để so sánh & truy vết). Đây là lý do `updated:` có trong mọi mảnh.

---

## Reflection — chắt bài học mà KHÔNG mất chi tiết
Sau mỗi ~10–15 bài học mới: gộp/chắt các nguyên tắc bền lên Tầng 0, dọn mục trùng. **Nhưng cô đọng là LOSSY** (giống nén ảnh) — nên:
- **GIỮ BẢN GỐC trước khi cắt:** nhật ký bài học chi tiết để 1 file riêng (vd `Lessons.md`); Tầng 0 chỉ giữ bản đã chắt. Cần chi tiết thì còn nguồn để lùi.
- Kỳ vọng đúng: bạn đang **ghi lại cách hành xử để nạp vào ngữ cảnh**, KHÔNG phải huấn-luyện-lại model. Mảnh nhớ là "trí nhớ ngoài", không phải trọng số.

---

## Điều phối đa-phiên (khi chạy nhiều phiên song song)
Nhiều cửa sổ/người/agent cùng sửa 1 kho → giẫm chân. Giải bằng **quy tắc tự-nạp + 1 file `_Backlog.md` chung**, không cần phần mềm. Cốt lõi: đồng-bộ-trước-khi-làm · 1 việc=1 nhánh · nhận-việc-trước-khi-làm · xong-báo-3-thứ (backlog+mảnh-nhớ+việc-mới) · WIP=1 · lease có hạn. Đầy đủ 11 luật: [`multi-session.md`](multi-session.md). Mẫu: `templates/BACKLOG.template.md`.

---

## Bảng tiến độ mỗi nhóm (`tien-do`) + menu dự án
Mỗi nhóm nên có 1 file `tien-do` = bảng ✅/🔄/⏳ + nhật ký phiên → mở lại biết ngay đã tới đâu, khỏi nhớ. Khi người chủ "đọc bộ nhớ", AI có thể quét các `tien-do` rồi hiện **MENU dự án đánh số** (trạng thái + việc-tiếp) để chọn. Mẫu: `templates/tien-do.template.md`. Phân biệt: `tien-do` (trạng thái+nhật ký) ≠ `_Backlog` (điều phối) ≠ `INDEX` (mục lục).

---

## Xem bằng Obsidian (tùy chọn)
Cây bộ nhớ này **đã là một Obsidian vault chuẩn** (markdown + `[[wikilink]]` + frontmatter, có sẵn `.obsidian/`). Muốn *nhìn* mạng lưới ký ức: cài [Obsidian](https://obsidian.md) (miễn phí) → **Open folder as vault** → trỏ vào thư mục bộ nhớ → bật **Graph view**. Đây chỉ để CON NGƯỜI xem/lần theo liên kết; AI vẫn dùng kho theo cách đọc phân tầng. Không bắt buộc.

> ⚠️ **Luật link khi tên file trùng nhau:** nếu cùng một tên file xuất hiện ở nhiều nhóm (vd `INDEX`, `tien-do`), wikilink BẮT BUỘC ghi rõ đường dẫn: `[[Nhóm/tien-do]]`, KHÔNG để `[[tien-do]]` trần (kẻo trỏ nhầm / gãy âm thầm). Tên file **duy nhất toàn kho** thì cứ `[[tên]]` thuần như thường.

---

## Phụ lục A — bảng nghĩa `status` (AI tự gán)
Người chủ non-tech thường mơ hồ với các nhãn này → **AI tự gán theo bảng dưới, đừng hỏi**; người chủ chỉ lướt INDEX, thấy sai thì nói 1 câu.

| Nhãn | Nghĩa đời thường |
|---|---|
| live | Đang **chạy thật, dùng được ngay** (đã deploy phục vụ) |
| wip | **Đang làm dở**, chưa xong — kể cả đã chạy thử trên dev mà chưa go-live |
| plan | **Dự định làm**, chưa bắt tay |
| research | **Đang tìm hiểu/cân nhắc**, chưa quyết |
| done | **Việc làm 1 lần đã xong** (1 đợt rà soát, 1 buổi kiểm thử) — không chạy tiếp |
| reference | **Kiến thức/quy tắc/tài liệu để tra** — không phải việc đang chạy |
| maintain | **Đã bàn giao**, thỉnh thoảng mới đụng |
| blocked | **Đang kẹt**, chờ thứ bên ngoài |
| archived | **Hết dùng**, giữ làm lịch sử (không xoá) |

**Ranh giới hay nhầm:** đã go-live phục vụ thật = `live`; còn lại (dù chạy trên dev) = `wip`. Mảnh là *quy tắc/sơ đồ/chuẩn/tài liệu* (dù tên có chữ "live") → `reference`.
