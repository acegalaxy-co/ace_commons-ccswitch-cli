# ccswitch — Cơ chế & Setup (dev handoff)

> Tài liệu kỹ thuật đầy đủ cho team dev. README.md là quickstart cho người dùng cuối; file này giải thích **cơ chế bên trong**, **auto-switch**, **giới hạn**, và **cách test**.
>
> **Last updated:** 2026-07-15

---

## 1. ccswitch là gì

CLI đổi endpoint auth của **Claude Code** giữa nhiều "profile" — chỉ thay block `env` trong `settings.json`, giữ nguyên phần còn lại (hooks, permissions, statusLine…).

2 profile chuẩn (theo thứ tự ưu tiên fallback):

| Profile | Endpoint | Vai trò |
|---|---|---|
| `9router` | `https://9router.proxy.com/v1` | ⭐ DEFAULT — remote router (multi-model, token riêng) |
| `original` | `https://api.anthropic.com` | Safe-harbor fallback (cuối cùng) — nối thẳng Anthropic, **cần `ANTHROPIC_API_KEY` thật** |

Alias tương thích ngược: `direct → original`.

> **2026-07-15:** tier `local` (`http://127.0.0.1:20128/v1`) đã gỡ khỏi module — đồng bộ 2-tier với launcher `scripts/9router-claude.sh` ở Nexus root.

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
ccswitch              # xem endpoint hiện tại + health cả 2 profile
ccswitch 9router      # switch → remote
ccswitch original     # switch → Anthropic direct
ccswitch check        # probe health tất cả profile
ccswitch fallback     # chọn profile healthy đầu tiên: 9router → original
ccswitch clear        # gỡ block env (về Anthropic-direct mặc định)
```

Mỗi lần `apply` tạo backup `settings.json.bak`. Health probe:
- Router (`9router`): `GET {base}/models` + `Authorization: Bearer <token>`.
- `original` (api.anthropic.com): thêm header `anthropic-version: 2023-06-01` (thiếu → endpoint sống vẫn báo DOWN).
- Timeout 4s → coi như `000` (down).

---

## 5. Auto-switch khi timeout / lỗi

Hook `hooks/check-router.sh` chạy ở sự kiện **SessionStart** (đã wire vào `settings.json` bởi `setup.sh`).

**Banner (LUÔN in đầu session):** mỗi lần mở session hook in ngay: endpoint đang chạy (đọc `$ANTHROPIC_BASE_URL` env — endpoint session thực dùng — fallback settings.json), thứ tự fallback, và lệnh sơ lược. Ví dụ:

```
━━━ ccswitch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ Endpoint đang chạy: 9router (remote router)  (https://9router.proxy.com/v1)
  Fallback (khi router chết): 9router → original
    • original = safe-harbor: LUÔN về được (cần key sk-ant- thật để không lỗi)
  Lệnh: ccswitch [check | 9router | original | fallback | clear]
        đổi endpoint xong → RESTART Claude Code (env nạp lúc khởi động)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ health=200 OK
```

### Flow

```
SessionStart
   │
   ▼
đọc .env.ANTHROPIC_BASE_URL từ settings.json
   │
   ├─ base KHÔNG phải router (9router) → exit 0 (bỏ qua)
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
   chạy `ccswitch fallback`
   │
   ├─ 9router healthy? → apply, xong
   └─ 9router chết → FORCE apply `original` (safe-harbor, KHÔNG cần probe 200)
        → Claude luôn đáp về Anthropic-direct, không bao giờ kẹt trên router chết
        → nếu original probe 401/403 (key sai) vẫn switch NHƯNG cảnh báo phải điền key thật
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

## 6. Fallback chain & safe-harbor (KHÔNG để Claude chết)

Thứ tự: **9router → original**.

- **9router**: chỉ được chọn khi probe **200**.
- **`original` = SAFE-HARBOR cuối cùng**: nếu 9router chết, `fallback` **luôn force apply `original` — KHÔNG cần probe 200**. Lý do: thà nối thẳng Anthropic-direct còn hơn để Claude kẹt trên router chết; và probe `/models` có thể false-negative (IPv6 route, transient) trong khi `/messages` vẫn chạy. → Claude **không bao giờ** ở lại endpoint chết.

- ✅ Đã test (xem §8): fallback bỏ qua router chết rồi force sang `original`, kể cả khi `original` cũng probe fail — settings vẫn được ghi sang `original`.

⚠️ **Điều kiện để safe-harbor thật sự cứu Claude:** `original.json` phải có **ANTHROPIC_API_KEY thật** (`sk-ant-...`). Bản ship là placeholder → probe **401** → khi force sang original, Claude **vẫn lỗi 401** trên mọi call (force-switch không tự tạo được key). `fallback` sẽ in cảnh báo rõ khi gặp 401/403.

```bash
$EDITOR ~/.claude/profiles/original.json   # điền ANTHROPIC_API_KEY thật (sk-ant-...)
ccswitch check                             # xác nhận: original: 200 OK  ← BẮT BUỘC trước khi tin dùng
```

Chừng nào `ccswitch check` báo `original: 200` thì đảm bảo "mọi lỗi router → về original sống" mới thành thật. Nếu vẫn 401 → key sai/thiếu, safe-harbor chỉ chuyển endpoint chứ không cứu được.

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

Ý tưởng: cho 9router trỏ port chết, `original` trỏ mock server 200 → xác nhận fallback bỏ qua router chết và switch sang `original`.

```bash
# mock "endpoint cuối" trả 200
python3 -c "import http.server as s;h=s.BaseHTTPRequestHandler;h.do_GET=lambda x:(x.send_response(200),x.end_headers());h.log_message=lambda *a:None;s.HTTPServer(('127.0.0.1',28099),h).serve_forever()" &

T=$(mktemp -d)/home; mkdir -p "$T/.claude/profiles" "$T/.claude/hooks"
cp ccswitch.sh "$T/.claude/ccswitch.sh"; chmod +x "$T/.claude/ccswitch.sh"
cp hooks/check-router.sh "$T/.claude/hooks/"; chmod +x "$T/.claude/hooks/check-router.sh"
printf '{"ANTHROPIC_BASE_URL":"https://9router.proxy.com:9/v1","ANTHROPIC_AUTH_TOKEN":"x"}\n' > "$T/.claude/profiles/9router.json"
printf '{"ANTHROPIC_BASE_URL":"http://127.0.0.1:28099/v1","ANTHROPIC_API_KEY":"stub"}\n'          > "$T/.claude/profiles/original.json"
printf '{"permissions":{"allow":["Bash(*)"]},"env":{"ANTHROPIC_BASE_URL":"https://9router.proxy.com:9/v1"}}\n' > "$T/.claude/settings.json"

HOME="$T" bash "$T/.claude/hooks/check-router.sh"
jq -r '.env.ANTHROPIC_BASE_URL' "$T/.claude/settings.json"   # EXPECT: http://127.0.0.1:28099/v1
```

Kết quả mong đợi: hook in `9router down → first healthy: original`, và `settings.json` đổi sang mock. → **fallback cuối chạy đúng**.

### 8.3 Tất cả down → safe-harbor vẫn force về original

Như 8.2 nhưng `original` cũng trỏ port chết. Kỳ vọng (hành vi mới): hook in `9router down → ⚠ original probe=... forcing anyway`, và `settings.json` **vẫn được ghi sang `original`** (KHÔNG kẹt trên router chết). Đây là điểm "mọi lỗi phải về original".

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
| `model_not_found` | Với 9router model phải có prefix `cc/` (vd `cc/claude-opus-4-8`). `original` dùng id gốc. |
| `original` luôn DOWN (4xx: 401/404) | Key placeholder/sai. Điền `sk-ant-` thật vào `profiles/original.json`, rồi `ccswitch check` phải thấy `original: 200`. |
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

- **2026-07-15** — Remove tier `local` (`:20128`): đồng bộ 2-tier (`9router → original`) khớp launcher `scripts/9router-claude.sh` ở Nexus root. Bỏ alias `router` (giữ `direct → original`). Xóa `profiles/local.json`. Cập nhật `ccswitch.sh` + `ccswitch.ps1` + `hooks/check-router.sh` + `setup.sh` + `setup.ps1` + README + MECHANISM. Verify sandbox test 2-tier (§8).
- **2026-07-14** — Auto-switch: hook `check-router.sh` nâng từ warn-only → tự `ccswitch fallback` khi timeout/lỗi (tắt bằng `CCSWITCH_NO_AUTO=1`). Thêm lệnh `ccswitch clear`. Probe fix header `anthropic-version` cho `original`. Fix hiển thị health `000` (trước bị `000000`). Parity PowerShell (probe header + `clear`). Verify bằng sandbox test (§8).
- **Init** — ccswitch CLI 9router/local/original + warn-only SessionStart hook + cross-platform setup.
