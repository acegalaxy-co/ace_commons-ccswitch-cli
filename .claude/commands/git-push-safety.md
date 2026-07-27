---
description: Chạy test, gitleaks, sensitive-content scan; chỉ push nếu cả 3 pass
---

Chạy đúng pipeline này, theo thứ tự, dừng ở lần fail đầu tiên. Không skip
bước hoặc tiếp tục qua một lần fail. Report kết quả từng bước cho user khi
hoàn thành.

## 1. Tests

Đầu tiên phát hiện lệnh test của project bằng cách kiểm tra repo (theo
thứ tự này, dừng ở match đầu tiên):

- có `test/*.bats` → `bats test/*.bats`
- `package.json` có field `scripts.test` → `npm test`
- có `pyproject.toml`, `pytest.ini`, hoặc thư mục `tests/` → `pytest`
- có `go.mod` → `go test ./...`
- có `Cargo.toml` → `cargo test`
- không cái nào ở trên → KHÔNG đoán. Check README / CI config để tìm
  lệnh test, hoặc hỏi user. Không im lặng skip bước này.

Chạy lệnh đã phát hiện. Nếu bất kỳ test nào fail (exit code khác 0), DỪNG. Báo
tên test fail và không tiếp tục sang bước 2. Không tự fix hay
retry — báo lỗi rõ ràng và hỏi user cách xử lý tiếp.

## 2. gitleaks scan

Chạy: `gitleaks detect --source "$(git rev-parse --show-toplevel)" --redact -v`

Nếu gitleaks chưa cài, DỪNG và báo user cài đặt — không
im lặng skip. Đề xuất lệnh theo platform của họ:

- macOS: `brew install gitleaks`
- Linux: package manager của distro (`apt install gitleaks`, `pacman -S gitleaks`, …)
- Windows: `scoop install gitleaks` hoặc `choco install gitleaks`
- OS nào có Go: `go install github.com/gitleaks/gitleaks/v8@latest`

(Khác với advisory pre-push hook, command này nên coi scanner bị thiếu
là hard stop, vì user đã yêu cầu rõ ràng push có gate.)

Nếu gitleaks tìm thấy bất kỳ leak nào, DỪNG. Hiện finding đã redact và không
tiếp tục. Không dùng `GITLEAKS_SKIP=1` thay mặt user — bypass đó
là quyết định họ tự làm thủ công, không phải command tự quyết.

## 3. Sensitive-content scan

Trước tiên invoke skill `/check-hardcode` (quét rộng: IP/domain/email/generic
hardcode mà hook auto-block cố ý bỏ qua vì false-positive). Nếu skill report
finding đáng ngại, DỪNG — không tiếp tục sang phán đoán thủ công bên dưới.

Rồi chạy `git status` và `git diff --stat` (so với branch upstream/main, hoặc
`HEAD` nếu có thay đổi chưa commit) để xem mọi thứ sắp được push. Rồi
đọc qua các file đã đổi thật và check:

- API key, token, credential thật (không phải placeholder như `<your-api-key>`
  hoặc `sk-...`)
- URL, hostname, chi tiết infra nội bộ hardcode chưa từng xuất hiện
  ở nơi khác trong repo
- Thông tin cá nhân (email, tên) chưa public trong git history của repo
- File nào trông như bị stage nhầm (vd `.env`, `*.bak`, file swap editor,
  credential dump)

Đây là bước phán đoán vượt ngoài regex pattern của gitleaks — nó bắt được
những thứ như URL nội bộ và file bị include nhầm, không phải "secret" điển
hình. Nếu tìm thấy gì đáng ngại, DỪNG và mô tả nó — không tự
quyết định đơn phương là ổn.

## 4. Push

Chỉ khi bước 1-3 đều pass: hiện cho user chính xác cái gì sắp được push
(`git status`, branch hiện tại, remote) và hỏi xác nhận rõ ràng
trước khi chạy `git push`. Không bao giờ force-push như một phần của command
này trừ khi request của user trong conversation này yêu cầu rõ ràng force
push.
