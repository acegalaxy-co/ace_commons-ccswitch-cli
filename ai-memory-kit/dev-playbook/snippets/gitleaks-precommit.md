# Chặn secret + bảo vệ nhánh chính

## pre-commit gitleaks (chặn secret TRƯỚC khi commit)
`.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```
Cài: `pip install pre-commit && pre-commit install`. Từ đó mỗi `git commit` tự quét; thấy token/khoá → chặn.

Quét toàn repo 1 lần (kể cả lịch sử):
```bash
gitleaks detect --source . --verbose
```

## GitHub Actions — `gitleaks-action` cần khối `permissions`
Trên trigger `pull_request`, `gitleaks-action` gọi API liệt kê commit của PR → cần quyền `pull-requests: read`. **Thiếu khối này → action lỗi 403** ("Resource not accessible by integration"), KHÔNG phải "lộ secret". Nếu bước còn `continue-on-error: true` thì lỗi 403 bị **NUỐT LẶNG** → CI vẫn xanh, trông như "đã quét sạch" nhưng **thực ra chưa quét được lần nào**.
```yaml
name: secret-scan
on: [push, pull_request]
permissions:
  contents: read
  pull-requests: read   # THIẾU dòng này → gitleaks-action 403 khi chạy trên PR
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # full history — cần để gitleaks quét đúng
      - uses: gitleaks/gitleaks-action@v2
```
> ⚠️ **Gitleaks quét CẢ lịch sử commit của PR, không chỉ diff cuối cùng.** Nếu 1 commit CŨ trong PR từng chứa chuỗi giống secret (vd khoá giả trong fixture test), sửa/inline-allow ở commit SAU **KHÔNG xoá được finding của commit cũ** — cổng vẫn đỏ. Xử theo thứ tự hẹp→rộng: (a) `.gitleaksignore` ở gốc repo ghi đúng vân tay (`commit:file:rule:line`, copy từ log gitleaks dòng `Fingerprint:`) — bỏ đúng 1 finding, không đụng cấu hình chung; (b) allowlist path/regex riêng trong cấu hình gitleaks; (c) squash-merge để gộp về 1 commit sạch khi merge vào main.

## Bảo vệ nhánh chính (GitHub, dùng gh)
```bash
gh api -X PUT repos/<org>/<repo>/branches/main/protection \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F enforce_admins=true \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=ci' \
  -F restrictions=
```
+ Bật **Secret scanning** + **Push protection** trong Settings → Security (chặn push secret lên GitHub).

## .gitignore tối thiểu
```
.env
.env.*
*.pem
*.key
```
> Secret thật để ở **két riêng NGOÀI repo** + biến môi trường hạ tầng. Trong repo/tài liệu chỉ ghi **tham chiếu** (ở đâu, 4 số cuối, dùng cho gì).
