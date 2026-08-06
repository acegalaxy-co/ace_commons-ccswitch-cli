# 16 — Mô hình triển khai trunk (1 nhánh main=live) + preview per-PR

🎯 **Vấn đề:** mô hình `dev`/`staging` cố định hợp thời ĐỘI NHÓM (có người QA gác). Một người + AI thì 2 môi trường cố định gây **drift** (dev lệch live, quên đẩy) + tốn tiền. Giải: **máy gác thay người gác**.

## ✅ Cách làm — 3 cơ chế (kèm bài 03 feature-flag)

### ① Trunk — 1 nhánh `main` = live
- Không giữ branch `dev`/`staging` lâu dài. Mỗi thay đổi → nhánh tính năng NGẮN (<1–2 ngày) → PR → merge → live.
- Config khác môi trường để ở **biến môi trường** (nền tảng deploy), KHÔNG trong code (tránh "config dev lẫn vào nhánh không merge được").
- Bỏ env staging cố định = hết drift + tiết kiệm.

### ② Feature flag — ship rồi mới bật (chi tiết: [bài 03](03-feature-flag.md))
- Bọc cả đợt thay đổi trong 1 flag **TẮT** → merge an toàn mọi lúc; bật khi nghiệm thu xong / tắt khẩn không cần deploy lại.
- ⚠️ **Flag debt:** đặt hạn xóa flag NGAY khi tạo (kẻo tích thành mê cung).

### ③ Preview per-PR — bản xem trước TẠM (thay env dev trường tồn)
- Mỗi PR → nền tảng tự tạo 1 URL xem trước (Railway PR env, Vercel/Netlify preview…). Tự xóa khi merge/close → không drift.
- Preview dùng **DB riêng/sandbox**, KHÔNG dùng chung DB prod hay DB dev nhiều người. Bootstrap có 2 tầng chặn nhầm prod:
```js
// scripts/preview-bootstrap.mjs (chạy preDeploy)
if (process.env.NODE_ENV === 'production') throw new Error('ABORT: không chạy trên prod');
if (!process.env.PREVIEW_BOOTSTRAP)        throw new Error('ABORT: thiếu cờ PREVIEW_BOOTSTRAP');
await runMigrations(db); await seedDemoData(db);
```

### Lưới QA tự động (thay người QA)
CI `tsc --noEmit` cổng cứng + lint + test + quét secret (bài 11) · error tracking + uptime + resource monitor (bài 09/14) · **rollback nhanh** (revert commit → merge → auto-deploy <5'). **Cổng go-live vẫn ở người: bấm merge PR = duyệt production.**

## 📋 Checklist
- [ ] Chỉ 1 nhánh `main` = live; nhánh tính năng ngắn
- [ ] Config theo môi trường ở biến môi trường, không trong code
- [ ] Tính năng mới bọc feature flag + đặt hạn xóa flag
- [ ] PR có preview riêng + DB sandbox + 2 tầng chặn nhầm prod
- [ ] CI cổng cứng + giám sát + rollback nhanh là lưới QA

## ⚠️ Cạm bẫy
- Giữ `dev` branch song song → lại drift. Trunk là 1 nhánh.
- Preview chĩa DB prod/dev-chung → hỏng data thật. Luôn sandbox + chặn.
- Tạo flag không đặt hạn xóa → nợ flag.

> Hợp: 1 người / đội nhỏ + AI. Rửa: tên nền tảng/service, tên DB, repo.
