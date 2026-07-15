# ccswitch — Claude Code endpoint switcher

Đổi nhanh endpoint auth của **Claude Code** giữa **9router** (mặc định) và **Anthropic direct** — chỉ thay block `env` trong `~/.claude/settings.json`, không đụng phần còn lại (hooks, permissions...).

| Profile | Endpoint | Vai trò |
|---|---|---|
| **`9router`** | `https://9router.acegalaxy.co/v1` | ⭐ **DEFAULT** — remote router (multi-model, key riêng) |
| `original` | `https://api.anthropic.com` | Safe-harbor fallback — nối thẳng Anthropic (cần `ANTHROPIC_API_KEY` thật) |

> Alias tương thích ngược: `direct` → `original`.

---

## 1. Cài đặt

### macOS / Linux

```bash
git clone git@github.com:acegalaxy-co/ace_commons-ccswitch-cli.git
cd ace_commons-ccswitch-cli
bash setup.sh
```

Cần `jq` + `curl`:
- mac: `brew install jq`
- ubuntu/debian: `sudo apt install -y jq curl`

### Windows (PowerShell)

```powershell
git clone git@github.com:acegalaxy-co/ace_commons-ccswitch-cli.git
cd ace_commons-ccswitch-cli
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

> Health-check hook dùng `bash` (Git Bash / WSL). Không có cũng không sao — hook tự bỏ qua, `ccswitch` vẫn chạy.

Installer sẽ:
1. Copy `ccswitch` + hook + **profile template** vào `~/.claude/`.
2. Wire hook `SessionStart` (probe endpoint, cảnh báo nếu DOWN) — idempotent.
3. Thêm alias/function `ccswitch` vào shell profile.
4. **KHÔNG ghi đè** profile đã có key thật (chỉ copy template khi file thiếu).

---

## 2. Điền key (bắt buộc 1 lần)

Template dùng placeholder — thay bằng key thật:

```bash
# mac/linux
$EDITOR ~/.claude/profiles/9router.json     # thay <your-9router-key>
```
```powershell
# windows
notepad $env:USERPROFILE\.claude\profiles\9router.json
```

> 🔑 Xin key 9router từ lead. **Không commit key** — file `~/.claude/profiles/*.json` là local, không đẩy git.

---

## 3. Dùng

```bash
ccswitch                # xem endpoint hiện tại + health cả 2 profile
ccswitch 9router        # → remote (default)
ccswitch original       # → Anthropic direct
ccswitch check          # probe health tất cả profile
ccswitch fallback       # 9router nếu healthy; router chết → FORCE về original (safe-harbor)
ccswitch clear          # gỡ block env (về Anthropic-direct mặc định)
```

Windows: cú pháp giống hệt (`ccswitch 9router`, ...).

> ⚠️ **Sau mỗi lần switch phải RESTART Claude Code** (quit + mở lại) — env chỉ load lúc khởi động.

### Auto-switch khi timeout/lỗi

Hook `SessionStart` (`hooks/check-router.sh`) probe endpoint đang active mỗi lần mở session. Nếu nó **timeout hoặc lỗi** (health ≠ 200), hook **tự chạy `ccswitch fallback`** → ghi profile healthy đầu tiên vào `settings.json`.

- **Giới hạn:** env nạp lúc process start, **trước** hook → switch heal cho lần mở **kế tiếp**; session hiện tại có thể còn endpoint cũ tới khi Reload Window / restart.
- **Mid-session** (đang chat mà API lỗi) **không** auto-switch được (Claude Code không có hook on-error) — đó là việc của router upstream-failover.
- **Tắt auto-switch** (chỉ cảnh báo như cũ): `export CCSWITCH_NO_AUTO=1`.

Ví dụ output `ccswitch`:
```
current base: https://9router.acegalaxy.co/v1
  9router: 200 OK
  original: 404 DOWN      ← chưa điền key original (bình thường nếu không dùng)
profiles: 9router original
```

---

## 4. Model — nhớ prefix `cc/`

Với `9router`, model **phải** có prefix `cc/`:

| Alias | Model id |
|---|---|
| Opus | `cc/claude-opus-4-8` |
| Sonnet | `cc/claude-sonnet-5` |
| Haiku | `cc/claude-haiku-4-5-20251001` |
| Fable | `cc/claude-fable-5` |

Thiếu prefix → lỗi `model_not_found`. (Profile `original` dùng id gốc **không** prefix.)

---

## 5. Troubleshoot

**`ccswitch` báo `9router: 000 DOWN` nhưng endpoint vẫn sống**
Thường do **IPv6 route hỏng** — host resolve ra cả A (IPv4) + AAAA (IPv6), nhưng path IPv6 timeout. Claude Code (Node) tự né sang IPv4 nên vẫn chạy; chỉ `curl`/health-probe bị kẹt. Xác minh:
```bash
curl -4 --resolve 9router.acegalaxy.co:443:172.66.43.28 https://9router.acegalaxy.co/v1/models -H "Authorization: Bearer <key>"
```
Nếu IPv4 trả `200` → endpoint OK, bỏ qua cảnh báo. Muốn dứt điểm: pin IPv4 vào `/etc/hosts`.

**`No active credentials for provider` / `model_not_found`**
Sai model id — thêm prefix `cc/` (xem mục 4).

**`API key required for remote API access`**
Key trong profile là placeholder hoặc key local nhầm sang remote. Điền đúng key 9router.

**Switch xong không đổi**
Chưa restart Claude Code. Quit hẳn rồi mở lại.

**Khôi phục settings**
Mỗi lần switch tạo backup `~/.claude/settings.json.bak`. Lỗi thì:
```bash
cp ~/.claude/settings.json.bak ~/.claude/settings.json
```

---

## 6. Bảo mật

- Profile `~/.claude/profiles/*.json` chứa key thật → **local only**, không commit.
- Template trong repo này chỉ có placeholder `<your-...-key>`.
- `setup` không bao giờ ghi đè profile đã có key.

---

## File trong package

```
ccswitch-cli/
├── README.md                 # tài liệu này
├── ccswitch.sh               # tool (mac/linux)
├── ccswitch.ps1              # tool (windows)
├── setup.sh                  # installer mac/linux
├── setup.ps1                 # installer windows
├── hooks/
│   └── check-router.sh       # SessionStart health probe
└── profiles/                 # TEMPLATE (placeholder key, an toàn để commit)
    ├── 9router.json
    └── original.json
```
