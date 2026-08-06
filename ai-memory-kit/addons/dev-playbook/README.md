# Dev Playbook — cẩm nang kỹ thuật tái dùng

> Gói **know-how phát triển** đúc từ thực chiến (đã rửa sạch danh tính) cho anh em dev: mỗi "bài" giải 1 việc lặp lại, kèm **checklist** + **code mẫu** trong `snippets/`. Mục tiêu: dựng dự án mới nhanh + đúng, không phát minh lại bánh xe.
>
> 🆚 Khác **MemoryOS kit** (thư mục gốc của repo = tủ ký ức AI). Dev Playbook = code/hạ tầng. Phần "trí nhớ / làm việc với AI / nạp tài liệu" xem MemoryOS, KHÔNG lặp ở đây.

## Cách dùng
Mỗi bài theo khuôn: 🎯 **Vấn đề** → ✅ **Cách làm** → 📋 **Checklist** (copy được) → 💻 **Code mẫu** (`snippets/`, đã rửa + placeholder) → ⚠️ **Cạm bẫy**. Mở bài cần đến, chép checklist + snippet, thay placeholder `<...>` cho dự án của bạn.

## Mục lục
| # | Bài | Code mẫu |
|---|---|---|
| 01 | [Deploy Railway an toàn + kiểm site sống](01-deploy-railway-an-toan.md) | `snippets/health-check.ts` · `snippets/railpack-env.md` |
| 02 | [Supabase an toàn: 3-DB · RLS · SQL idempotent · migration](02-supabase-an-toan.md) | `snippets/sql-idempotent.sql` · `snippets/rls-checklist.sql` |
| 03 | [Feature-flag 2 đầu (bật/tắt tính năng từ Admin)](03-feature-flag.md) | `snippets/feature-flag.ts` |
| 04 | [Rate-limit cổng API (token-bucket)](04-rate-limit.md) | `snippets/rate-limit.ts` |
| 05 | [Khuôn CMS Express + Cheerio + i18n](05-cms-express-cheerio.md) | `snippets/cms-render.js` |
| 06 | [Thủ thuật clone web tĩnh](06-clone-web.md) | (snippet trong bài) |
| 07 | [Chuẩn an toàn Git & Claude Code](07-an-toan-git-claude.md) | `snippets/gitleaks-precommit.md` |
| 08 | [Chuẩn tài liệu hệ thống + hướng dẫn trong app](08-chuan-tai-lieu.md) | — |
| 09 | [Observability + Autofix (hộp lỗi trung tâm, 7 nguyên tắc)](09-observability-autofix.md) | `snippets/error-report-schema.ts` |
| 10 | [Điều phối đa-phiên (11 luật) — trỏ chéo MemoryOS](10-dieu-phoi-da-phien.md) | — |
| 11 | [Đảm bảo chất lượng đa-lớp (4 lưới defense-in-depth)](11-dam-bao-chat-luong-4-luoi.md) 🆕 | (snippet trong bài) |
| 12 | [Audit log + Hoàn tác + Xác nhận (app non-tech sửa data)](12-audit-log-undo-confirm.md) 🆕 | (snippet trong bài) |
| 13 | [Đối soát import/migration 5 chiều](13-doi-soat-import-migration.md) 🆕 | (snippet trong bài) |
| 14 | [Giám sát job nền/cron 4 lớp](14-giam-sat-job-nen.md) 🆕 | (snippet trong bài) |
| 15 | [Cạm bẫy hay gặp (server-action · Portal · Supabase RAM)](15-gotchas-thuong-gap.md) 🆕 | `snippets/server-action-result.ts` · `modal-portal.tsx` · `supabase-client.ts` |
| 16 | [Mô hình trunk (main=live) + preview per-PR](16-mo-hinh-trunk-preview.md) 🆕 | (snippet trong bài) |
| 17 | [Toàn vẹn tiền: ghi sổ an toàn 5 luật + thanh toán chốt-khi-PAID](17-toan-ven-tien.md) 🆕 | `snippets/money-guard.sql` · `payment-finalize-latch.ts` |
| 18 | [Che PII ở admin (mask+reveal-audit) + KYC tự-khai-duyệt](18-che-pii-va-kyc.md) 🆕 | `snippets/pii-mask.ts` |
| 19 | [Cảnh báo bất thường rule-based + đối-soát dashboard](19-canh-bao-bat-thuong-va-doi-soat.md) 🆕 | (snippet trong bài) |
| 20 | [Chống trùng hồ sơ + xóa có dây chuyền (xem-trước cascade)](20-chong-trung-va-xoa-day-chuyen.md) 🆕 | (snippet trong bài) |
| 21 | [CI tiết kiệm chi phí (gate bước nặng sang PR)](21-ci-tiet-kiem-chi-phi.md) 🆕 | `snippets/ci-cost.yml` |
| 22 | [Template email/tài liệu non-tech 3 tầng + xem-trước](22-template-non-tech-3-tang.md) 🆕 | (snippet trong bài) |
| 23 | [Kiểm site/service sống-chết đáng tin (chống báo giả)](23-monitor-status-dang-tin.md) 🆕 | (snippet trong bài) |
| 24 | [Sinh ảnh share social (OG + story) render server](24-share-card-social-og.md) 🆕 | (snippet trong bài) |
| 25 | [Rà cửa hậu dev-bypass trước go-live (NODE_ENV không phải cờ bảo mật)](25-golive-ra-cua-hau-bypass.md) 🆕 | (snippet trong bài) |
| 26 | [Robot tự-vá (self-heal) có lưới an toàn: 4 lằn ranh + điều kiện auto-merge](26-robot-tu-va-self-heal.md) 🆕 | (snippet trong bài) |
| 27 | [Dựng để bàn giao ngay từ đầu (mô hình 3 vai: chủ · IT · dev)](27-dung-de-ban-giao.md) 🆕 | (snippet trong bài) |
| 28 | [Cổng đăng-nhập chuẩn (chặn KHUNG không chỉ data · verify JWT theo thuật-toán-ký)](28-cong-dang-nhap-chuan.md) 🆕 | `snippets/graceful-shutdown.ts` |
| 29 | [RBAC phân quyền chuẩn (3 bảng + catalog quyền · seed idempotent · 2 bẫy khóa-sạch)](29-rbac-phan-quyen-chuan.md) 🆕 | (snippet trong bài) |
| 30 | [Harness E2E Playwright (auth-qua-API→storageState · smoke tham-số-hóa · bẫy tương tác)](30-harness-e2e-playwright.md) 🆕 | (snippet trong bài) |
| 31 | [Kiểm-thử hình-ảnh 3 tầng (hình-học chặn-CI → pixel-diff cổng-hẹp → AI-vision nightly)](31-kiem-thu-hinh-anh-3-tang.md) 🆕 | (snippet trong bài) |

## Quy ước rửa (khi đóng góp/bê đi)
`<project>` tên dự án · `<prefix>_` tiền tố bảng · `<ref>`/`<domain>` ref/url hạ tầng · `<token>` secret (để ở két, chỉ tham chiếu). KHÔNG để tên công ty / path máy / secret trần. Đóng góp ngược: xem `../CONTRIBUTING.md`.
