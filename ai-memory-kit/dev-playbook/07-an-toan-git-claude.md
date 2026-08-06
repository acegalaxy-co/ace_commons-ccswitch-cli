# 07 — Chuẩn an toàn Git & Claude Code

## 🎯 Vấn đề
Nhiều người/agent cùng làm → dễ lộ secret lên Git, xoá nhầm nhánh chính, lẫn việc song song, hoặc AI tự làm việc nguy hiểm.

## ✅ Cách làm

### Git
- **Nhánh chính bất khả xâm phạm:** bật branch protection (cấm force-push/xoá), đổi qua **PR có review + CI xanh**.
- **Chặn secret:** Secret Scanning + Push Protection + **pre-commit `gitleaks`**; (tuỳ) ký commit.
- **Stage tường minh:** `git add <file>` đúng thứ mình đổi — **KHÔNG `git add -A`/`.`** (gom nhầm WIP người khác). `git commit -a` KHÔNG bắt file mới-toanh → vẫn phải `git add` file mới.
- **Sync TRƯỚC khi làm & trước khi push:** `git fetch` → đo trên `origin/<nhánh>`, mới hơn thì pull; đừng tin checkout local cũ.
- **Auto-merge (DEV):** xong + CI xanh + mergeable → tự merge + xoá nhánh (đừng hỏi đi hỏi lại). **Production vẫn cần cổng duyệt.**

### Secret
- KHÔNG secret trần trong repo/bộ nhớ. Để ở **két riêng NGOÀI** + `.env` (gitignore) + biến môi trường hạ tầng; trong tài liệu chỉ ghi **tham chiếu** (ở đâu, 4 số cuối, dùng cho gì).

### Claude Code (hoặc agent AI)
- Mô hình quyền **allow / ask / deny:** allow lint/test/build · ask cài đặt/deploy/đổi config prod · **deny** xoá phá hủy + ghi secret + lệnh không đảo ngược.
- **Plan mode** khi vào repo lạ; **least privilege**; người ở **cổng duyệt** việc nguy hiểm. AI **không tự bật bypass** rào của chính nó.

## 📋 Checklist
- [ ] Branch protection + PR review + status checks
- [ ] gitleaks pre-commit + Push Protection
- [ ] Quy ước `git add` tường minh, fetch trước push
- [ ] Secret ở két/env, repo chỉ tham chiếu
- [ ] Quyền AI allow/ask/deny + plan mode repo lạ

## 💻 Code mẫu
`snippets/gitleaks-precommit.md` — cấu hình hook + branch protection (lệnh `gh`).

## ⚠️ Cạm bẫy
- `git add -A` 1 lần là đủ gom nhầm secret/WIP → tập thói quen stage tường minh.
- "CI xanh" test MERGE với main mới nhất → đổi API dùng chung phải grep mọi nơi gọi.

## Bổ sung — PR xếp-chồng · rào an toàn agent AI

### PR xếp-chồng (stacked) + merge PR cha bằng SQUASH → PR con tự thành CONFLICT
**Bối cảnh:** làm 2 việc nối nhau, PR con (B) dựng TRÊN nhánh của PR cha (A) vì B cần code của A → nhánh B chứa cả commit của A lẫn B, trong khi PR B vẫn đặt base = nhánh chính.
**Triệu chứng:** merge PR A xong bằng **squash** → PR B đang ở trạng thái mergeable/clean bỗng chuyển sang **conflict**, dù chưa ai đụng gì thêm.
**Nguyên nhân:** squash gộp toàn bộ PR A thành **1 commit hash MỚI** trên nhánh chính. Git không nhận ra các commit gốc của A còn nằm trong nhánh B (hash cũ) là "đã merge" → khi merge 3-way B vào nhánh-chính-mới, các file bị cả A và B cùng sửa (lockfile, file cấu hình dùng chung…) xung đột thật.
**Cách gỡ:**
1. `git fetch` rồi `git rebase origin/<nhánh-chính>` trên nhánh B — Git tự nhận ra & bỏ qua các commit trùng patch-id với squash-commit của A, nhánh B chỉ còn lại commit của B.
2. Nếu môi trường/quyền cho force-push (`git push --force-with-lease`) → xong, PR B tự sạch.
3. Nếu force-push bị chặn (agent/CI không cho ghi-đè lịch sử remote) → **đừng cố lách**: đẩy nhánh B (đã rebase) sang một **nhánh mới**, mở **PR mới** thay PR B, đóng PR cũ kèm ghi chú "thay bằng PR mới".

**Phòng tránh:** hạn chế xếp chồng PR khi tách được; nếu buộc phải chồng → merge PR cha **trước**, rebase PR con **ngay** (đừng để lâu) rồi kiểm trạng thái mergeable sớm.

### Làm việc CÙNG rào an toàn của agent AI — đừng lách
**Nguyên tắc:** agent-coding-tool (Claude Code hay tương tự) thường có **2 tầng quyền độc lập**:
1. **Luật permission** (config allow/ask/deny cho từng lệnh) — quyết định lệnh có được **CHẠY** hay không.
2. **Classifier an toàn riêng** — chặn theo **bản chất của việc** (đụng secret, tiền, dữ liệu cá nhân, môi trường production, hành động khó/không thể đảo ngược), bất kể luật permission nói gì.

Hệ quả: có rule cho phép chạy 1 lệnh sẵn **không có nghĩa** classifier sẽ cho qua — nó xét theo ngữ cảnh việc đang làm lúc đó, không theo tên lệnh tĩnh.

**Kỷ luật khi bị chặn:**
- (a) Thử một cách hợp lệ khác **trước** khi kết luận "bị chặn" (tách lệnh ra thay vì gộp chung, dùng CLI trực tiếp thay vì qua lớp trung gian…).
- (b) Nếu vẫn chặn → nói rõ cho chủ sở hữu **cái gì đang bị chặn, vì sao**, và xin xác nhận **đúng-từ/đúng-giá-trị** cho đúng việc đó (một câu "ok" hay "làm đi" chung chung cho việc A **không** tự động là đồng ý cho việc B nhạy cảm hơn — vd "merge" khác "commit đi").
- (c) **Không** tự sửa cấu hình quyền của chính mình để né rào, **không** đổi tên/nguỵ trang hành động để lách qua classifier.

**Bảng tra nhanh — loại hành động hay bị chặn & cách gỡ đúng:**

| Loại hành động | Cách gỡ ĐÚNG |
|---|---|
| Đọc/gom secret thật (token, mật khẩu, service key) | Xin chủ mở đúng phạm vi đọc (vd đọc kho secret nội bộ để vận hành) — không quét ồ ạt cả kho; vẫn không ghi secret trần ra log/bộ nhớ/Git |
| Chạy DDL/migration hoặc ghi dữ liệu trên DB **production** | Xin duyệt riêng cho bước này; không suy diễn từ lời cho phép việc khác; ưu tiên đưa lệnh nguyên văn để chủ tự chạy |
| Push thẳng vào nhánh chính | Tách lệnh push đứng riêng (đừng gộp `&&` với lệnh khác); nếu vẫn chặn → làm xong việc, báo rõ "chờ duyệt push" |
| Merge PR do chính mình tạo | Trình PR đã xong + CI xanh, hỏi thẳng "merge PR #X được không?" — cổng là đúng-từ "merge", không phải "ship"/"xong rồi đó" |
| Xoá dữ liệu / hành động khó đảo ngược | Không tự thực hiện dù có rule allow sẵn; mô tả rõ hậu quả, xin xác nhận cụ thể trước khi chạy |
