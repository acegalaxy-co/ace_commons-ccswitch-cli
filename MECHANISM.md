# ccswitch — Cơ chế & Setup (dev handoff)

> Tài liệu kỹ thuật đầy đủ cho team dev. README.md là quickstart cho người dùng cuối; file này giải thích **cơ chế bên trong**, **auto-switch**, **giới hạn**, và **cách test**.
>
> **Last updated:** 2026-07-14

---

## 1. ccswitch là gì

CLI đổi endpoint auth của **Claude Code** giữa nhiều "profile" — chỉ thay block `env` trong `settings.json`, giữ nguyên phần còn lại (hooks, permissions, statusLine…).

3 profile chuẩn (theo thứ tự ưu tiên fallback):

| Profile | Endpoint | Vai trò |
|---|---|---|
| `9router` | `https://9router.acegalaxy.co/v1` | ⭐ DEFAULT — remote router (multi-model, token riêng) |
| `local` | `http://127.0.0.1:20128/v1` | Fallback 1 — router chạy trên máy dev |
| `original` | `https://api.anthropic.com` | Fallback 2 (cuối cùng) — nối thẳng Anthropic, **cần `ANTHROPIC_API_KEY` thật** |

Alias tương thích ngược: `router → local`, `direct → original`.

---

## 2. Claude Code đọc endpoint từ đâu — thứ tự ưu tiên (QUAN TRỌNG)

Đây là điểm hay gây nhầm. Claude Code lấy `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` theo thứ tự (cao → thấp):

```
1. Process env      (biến shell export TRƯỚC khi chạy `claude`)   ← THẮNG TẤT CẢ
2. settings.local.json  .env   (project-scoped, gitignored)
3. settings.json        .env   (project shared, hoặc ~/.claude global)
4. (không có) → Anthropic-direct mặc định
```

Hệ quả thực tế:

- **Env đã export trong terminal đè mọi file settings.** Nếu terminal có `ANTHROPIC_BASE_URL=...` (do rc file, launchctl, hoặc export tay), ccswitch sửa `settings.json` sẽ **không có tác dụng**. Kiểm tra: `env | grep ANTHROPIC`.
- **Env nạp lúc process khởi động**, không đọc lại giữa chừng → **phải restart Claude Code** (quit + mở lại) sau mỗi lần switch.
- ccswitch có 2 chế độ target (xem §3): global `~/.claude/settings.json` (mặc định của module) hoặc project `.claude/settings.local.json` (bản project-scoped).

---

## 3. Kiến trúc file

```
ccswitch-cli-claude/
├── README.md              # quickstart người dùng
├── MECHANISM.md           # tài liệu này (dev handoff)
├── ccswitch.sh            # CLI mac/linux — target ~/.claude/settings.json
├── ccswitch.ps1           # CLI windows (PowerShell) — parity với .sh
├── setup.sh               # installer mac/linux
├── setup.ps1              # installer windows
├── hooks/
│   └── check-router.sh    # SessionStart hook: probe + AUTO-SWITCH khi down
└── profiles/              # TEMPLATE placeholder key (an toàn commit)
    ├── 9router.json
    ├── local.json
    └── original.json
```

Sau `setup.sh`, các file được cài vào `~/.claude/`:

```
~/.claude/
├── ccswitch.sh                 # copy từ module (refresh mỗi lần setup)
├── hooks/check-router.sh       # copy từ module
├── profiles/*.json             # copy CHỈ KHI thiếu (không đè key thật)
└── settings.json               # được wire hook + đổi block env
```

---

## 4. Lệnh ccswitch

```bash
ccswitch              # xem endpoint hiện tại + health cả 3 profile
ccswitch 9router      # switch → remote
ccswitch local        # switch → local :20128
ccswitch original     # switch → Anthropic direct
ccswitch check        # probe health tất cả profile
ccswitch fallback     # chọn profile healthy đầu tiên: 9router → local → original
ccswitch clear        # gỡ block env (về Anthropic-direct mặc định)
```

Mỗi lần `apply` tạo backup `settings.json.bak`. Health probe:
- Router (`9router`/`local`): `GET {base}/models` + `Authorization: Bearer <token>`.
- `original` (api.anthropic.com): thêm header `anthropic-version: 2023-06-01` (thiếu → endpoint sống vẫn báo DOWN).
- Timeout 4s → coi như `000` (down).

---

## 5. Auto-switch khi timeout / lỗi

Hook `hooks/check-router.sh` chạy ở sự kiện **SessionStart** (đã wire vào `settings.json` bởi `setup.sh`).

### Flow

```
SessionStart
   │
   ▼
đọc .env.ANTHROPIC_BASE_URL từ settings.json
   │
   ├─ base KHÔNG phải router (9router / 127.0.0.1:20128 / localhost:20128) → exit 0 (bỏ qua)
   │
   ▼
probe {base}/models  (curl -m 4)
   │
   ├─ health = 200 → exit 0 (khỏe, không làm gì)
   │
   ▼ (health ≠ 200: timeout=000 hoặc error code)
   ├─ CCSWITCH_NO_AUTO=1  hoặc  ccswitch.sh không executable
   │     → chỉ CẢNH BÁO (warn-only, hành vi cũ) → exit 0
   │
   ▼ (auto-switch enabled)
   chạy `ccswitch fallback`  (9router → local → original)
   │
   ├─ tìm được profile healthy → ghi vào settings.json + nhắc restart/Reload Window
   └─ tất cả down → in ❌ "all profiles down", settings GIỮ NGUYÊN
```

### Giới hạn (đọc kỹ — tránh hiểu nhầm)

1. **Không heal session hiện tại ngay.** Env nạp lúc process launch, **trước** khi hook chạy. Switch trong hook ghi `settings.json` cho lần mở **kế tiếp**. Session đang mở vẫn dùng endpoint cũ đến khi **Reload Window / restart Claude Code**. → lần đầu gặp outage bạn mất 1 nhịp; các session sau tự đúng.
2. **Không cover mid-session.** Đang chat mà API timeout/lỗi → hook KHÔNG chạy lại (nó chỉ ở SessionStart). Claude Code không expose hook "on API error". Muốn zero-downtime giữa phiên → phải để **router upstream-failover** lo (việc của service router, không phải ccswitch).
3. **Chỉ engage khi đang ở router.** Nếu đang `original` (Anthropic direct) thì hook bỏ qua — không có "cấp trên" để fallback tới.

### Tắt auto-switch (về warn-only)

```bash
export CCSWITCH_NO_AUTO=1
```

---

## 6. Fallback chain & phao cứu sinh cuối

Thứ tự: **9router → local → original**. `ccswitch fallback` (và auto-switch hook) lặp theo thứ tự này, chọn cái **healthy đầu tiên**.

- ✅ Cơ chế chain đã test (xem §8): fallback lặp qua các endpoint chết và **switch sang endpoint healthy cuối cùng trong danh sách**; nếu tất cả chết thì báo lỗi sạch, không sửa settings.
- ⚠️ **`original.json` ship kèm placeholder key** (`<your-anthropic-api-key>`). Vì vậy trên máy chưa cấu hình, phao cuối cùng (`original`) sẽ **DOWN (404)** và fallback dừng ở `local`. Muốn `original` là phao thật:
  ```bash
  $EDITOR ~/.claude/profiles/original.json   # điền ANTHROPIC_API_KEY thật (sk-ant-...)
  ```
  Nếu không dùng Anthropic-direct thì bỏ qua — chỉ cần 1 trong 9router/local sống là đủ.

---

## 7. Setup

### macOS / Linux

```bash
cd ccswitch-cli-claude
bash setup.sh
# điền token: $EDITOR ~/.claude/profiles/9router.json
source ~/.zshrc && ccswitch 9router
# restart Claude Code
```

Yêu cầu: `jq` + `curl` (`brew install jq` / `apt install -y jq curl`).

### Windows (PowerShell)

```powershell
cd ccswitch-cli-claude
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

> Hook health-check dùng `bash` (Git Bash / WSL). Không có bash → hook tự bỏ qua, `ccswitch` vẫn chạy (mất auto-switch).

`setup` là idempotent: refresh tool+hook, chỉ copy profile khi thiếu (không đè key thật), wire hook SessionStart 1 lần, thêm alias `ccswitch`.

---

## 8. Cách test (tái lập được)

Test **không đụng `~/.claude` thật** — dùng `HOME` sandbox tạm. Đây là các test đã chạy khi build tính năng auto-switch.

### 8.1 Syntax

```bash
bash -n ccswitch.sh && bash -n hooks/check-router.sh
```

### 8.2 Fallback chain tới phao cuối (dùng mock 200)

Ý tưởng: cho 9router + local trỏ port chết, `original` trỏ mock server 200 → xác nhận fallback lặp qua 2 cái chết và switch sang `original`.

```bash
# mock "endpoint cuối" trả 200
python3 -c "import http.server as s;h=s.BaseHTTPRequestHandler;h.do_GET=lambda x:(x.send_response(200),x.end_headers());h.log_message=lambda *a:None;s.HTTPServer(('127.0.0.1',28099),h).serve_forever()" &

T=$(mktemp -d)/home; mkdir -p "$T/.claude/profiles" "$T/.claude/hooks"
cp ccswitch.sh "$T/.claude/ccswitch.sh"; chmod +x "$T/.claude/ccswitch.sh"
cp hooks/check-router.sh "$T/.claude/hooks/"; chmod +x "$T/.claude/hooks/check-router.sh"
printf '{"ANTHROPIC_BASE_URL":"https://9router.acegalaxy.co:9/v1","ANTHROPIC_AUTH_TOKEN":"x"}\n' > "$T/.claude/profiles/9router.json"
printf '{"ANTHROPIC_BASE_URL":"http://127.0.0.1:20129/v1","ANTHROPIC_AUTH_TOKEN":"x"}\n'          > "$T/.claude/profiles/local.json"
printf '{"ANTHROPIC_BASE_URL":"http://127.0.0.1:28099/v1","ANTHROPIC_API_KEY":"stub"}\n'          > "$T/.claude/profiles/original.json"
printf '{"permissions":{"allow":["Bash(*)"]},"env":{"ANTHROPIC_BASE_URL":"https://9router.acegalaxy.co:9/v1"}}\n' > "$T/.claude/settings.json"

HOME="$T" bash "$T/.claude/hooks/check-router.sh"
jq -r '.env.ANTHROPIC_BASE_URL' "$T/.claude/settings.json"   # EXPECT: http://127.0.0.1:28099/v1
```

Kết quả mong đợi: hook in `9router down → local down → first healthy: original`, và `settings.json` đổi sang mock. → **fallback cuối chạy đúng**.

### 8.3 Tất cả down → fail-safe

Như 8.2 nhưng `original` cũng trỏ port chết (vd `:28098`). Kỳ vọng: hook in `❌ all profiles down`, và `settings.json` **giữ nguyên** (không mutate).

### 8.4 Tắt auto-switch

```bash
HOME="$T" CCSWITCH_NO_AUTO=1 bash "$T/.claude/hooks/check-router.sh"
# EXPECT: chỉ cảnh báo, KHÔNG switch
```

> Không thể test end-to-end `original` tới Anthropic thật nếu chưa có `sk-ant-` key. Dùng mock 200 để verify **cơ chế chain**; muốn verify auth thật thì điền key rồi `ccswitch check`.

---

## 9. Troubleshoot

| Triệu chứng | Nguyên nhân / xử lý |
|---|---|
| Switch xong không đổi | Chưa restart Claude Code. Quit hẳn rồi mở lại. |
| `env | grep ANTHROPIC` có giá trị lạ | Process env đang đè settings (§2). `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN` hoặc quit hẳn VSCode/terminal rồi mở lại. |
| `check` báo `000 DOWN` nhưng endpoint sống | IPv6 route hỏng — Node né sang IPv4 nên vẫn chạy; chỉ curl kẹt. Verify: `curl -4 ... /v1/models`. Muốn dứt điểm: pin IPv4 vào `/etc/hosts`. |
| `model_not_found` | Với 9router/local model phải có prefix `cc/` (vd `cc/claude-opus-4-8`). `original` dùng id gốc. |
| `original` luôn DOWN (404) | Placeholder key. Điền `sk-ant-` thật vào `profiles/original.json`. |
| Auto-switch spam mỗi lần mở | Endpoint active đang down thật. Sửa router hoặc `ccswitch <profile khỏe>`. Tạm tắt: `export CCSWITCH_NO_AUTO=1`. |
| Khôi phục settings | `cp ~/.claude/settings.json.bak ~/.claude/settings.json` |

---

## 10. Bảo mật

- `profiles/*.json` trong `~/.claude/` chứa token thật → **local only, không commit**.
- Template trong repo chỉ có placeholder `<your-...>`.
- `setup` không bao giờ đè profile đã có key.
- Token không bao giờ được truyền qua CLI arg / prompt; chỉ nằm trong file profile + header `Authorization` khi probe.

---

## 11. Changelog

- **2026-07-14** — Auto-switch: hook `check-router.sh` nâng từ warn-only → tự `ccswitch fallback` khi timeout/lỗi (tắt bằng `CCSWITCH_NO_AUTO=1`). Thêm lệnh `ccswitch clear`. Probe fix header `anthropic-version` cho `original`. Fix hiển thị health `000` (trước bị `000000`). Parity PowerShell (probe header + `clear`). Verify bằng sandbox test (§8).
- **Init** — ccswitch CLI 9router/local/original + warn-only SessionStart hook + cross-platform setup.
