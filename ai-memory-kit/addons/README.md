# Addons — optional, KHÔNG nạp mặc định

Cẩm nang kỹ thuật (dev/AI-engineering) — tách khỏi core vì kit ưu tiên **bộ nhớ nghiệp vụ** (business rules) dùng chung nhiều dự án.

- **Làm dev / dựng feature dùng AI** → đọc `dev-playbook/` + `ai-patterns/`.
- **Chỉ dùng nghiệp vụ** (không code) → bỏ qua thư mục này, dùng thẳng core kit.

## Có gì

| Dir | Nội dung |
|---|---|
| `dev-playbook/` | Cẩm nang kỹ thuật + code mẫu: deploy, RLS, feature-flag, rate-limit, CMS… |
| `ai-patterns/` | Mẫu thiết kế tính năng AI: vòng-học, liên-kết-luồng, red-team… |
| `skills/` | 4 slash-command (`/ra-soat` `/kiem-thu` `/hoi-dong` `/don-tu`) |

`skills/` cần cả kit (hardcode path `tools/`) — copy vào `.claude/commands/` chỉ chạy đúng khi kit đầy đủ, không tách rời `skills/` mà thiếu `tools/`.
