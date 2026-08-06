# 09 — Observability + Autofix (hộp lỗi trung tâm, 7 nguyên tắc)

## 🎯 Vấn đề
Nhiều dịch vụ → lỗi rải rác, không ai thấy; muốn tiến tới "tự phát hiện + tự vá" nhưng sợ AI tự sửa bậy vào chỗ đụng tiền.

## ✅ Cách làm

### Kiến trúc 2 đầu
- **Đầu báo lỗi nhẹ** cắm vào mỗi service → gửi về **hộp lỗi TRUNG TÂM** (1 nơi xem). Báo lỗi KHÔNG được làm hỏng giao dịch chính (fire-and-forget, bọc try/catch).
- Callback "tự vá" mặc định **TẮT**, bật từng dự án có guard.

### 7 nguyên tắc autofix an toàn
1. **Lỗi giàu ngữ cảnh + fingerprint** (service/route/loại/stack rút gọn) để **gom trùng**, không spam.
2. **Rửa PII tại nguồn** — không để dữ liệu nhạy cảm trần vào hộp lỗi (hash/cắt).
3. **Reporter fail-safe** — lỗi của reporter không được kéo sập request thật.
4. **Chống bão lỗi** — rate-limit báo lỗi (1 sự cố lặp 1000 lần ≠ 1000 alert).
5. **VÙNG TIỀN = lằn ranh cứng** — đụng tiền/thanh toán: AI chỉ **ĐỀ XUẤT**, chờ người duyệt. "Nghi là tiền → coi là tiền".
6. **Phân quyền tự-vá theo vùng** — vùng KHÔNG-tiền (UI/chức năng) qua test tự động → cho tự-vá lên DEV; vùng tiền/production → cổng người.
7. **Đóng vòng** — theo dõi fingerprint sau khi vá; còn tái phát thì chưa đóng.

## 📋 Checklist
- [ ] Mỗi service có đầu báo lỗi → hộp trung tâm
- [ ] Lỗi có fingerprint gom trùng + rửa PII
- [ ] Reporter không làm hỏng giao dịch + có rate-limit
- [ ] Tự-vá chỉ vùng không-tiền + có test; vùng tiền chỉ đề xuất
- [ ] Có cầu chì/đường lùi (rollback) trước khi bật tự-vá

## 💻 Code mẫu
`snippets/error-report-schema.ts` — schema lỗi + hàm fingerprint + reporter fail-safe.

## ⚠️ Cạm bẫy
- Bật tự-merge/tự-vá mà không có test + fingerprint-lặp → robot sửa sai hàng loạt.
- Quên rửa PII → hộp lỗi trung tâm thành nơi rò dữ liệu.
