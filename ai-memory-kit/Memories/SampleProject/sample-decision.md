---
name: sample-decision
description: "Ví dụ 1 mảnh ký ức: quyết định dùng X thay Y vì Z. Xoá khi bắt đầu dự án thật."
status: reference
updated: 2026-01-01
capability: feature-flag
do-tin: vua
metadata:
  type: feedback
---

Đây là MẢNH MẪU để bạn thấy hình hài. Mỗi mảnh = 1 ý.

Ví dụ quyết định: "Chọn Postgres thay vì NoSQL cho SampleProject."

**Why:** dữ liệu quan hệ rõ, cần ràng buộc + giao dịch; đội quen SQL.
**How to apply:** mọi bảng đặt tiền tố `sample_`; migration code-first; không sửa tay schema production.

Liên quan [[sample-decision]] (tự trỏ chỉ để minh hoạ — thật thì trỏ mảnh khác).
