# ccswitch — Claude Code endpoint switcher

Đổi nhanh endpoint auth của **Claude Code** giữa các model qua **9router** và **subscription** (OAuth login gốc của Claude Code) — chỉ thay block `env` trong `~/.claude/settings.json`, không đụng phần còn lại (hooks, permissions...).

| Target | Cơ chế | Vai trò |
|---|---|---|
| **`claude`** | `env` = 9router + model `cc/*` (claude) | ⭐ **DEFAULT** — Claude qua 9router |
| `deepseek` | 9router + model `ds/*` | DeepSeek qua 9router |
| `subscription` | **gỡ block `env`** | Safe-harbor fallback — Claude Code dùng OAuth subscription login (không cần key) |

> `claude` / `deepseek` **chung 1 base URL** `https://9router.acegalaxy.co/v1` **và chung 1 key** (điền cùng 1 token 9router vào cả 2 profile); khác nhau **chỉ ở model prefix** (`cc/` vs `ds/`).
>
> _(Đã bỏ `codex`/GPT (`cx/*`): 9router trả raw OpenAI wire format cho `cx/*`, Claude Code không parse được. Thêm lại khi 9router có lớp dịch sang Anthropic format.)_
> `subscription` KHÔNG phải profile file: nó xóa block `env` để Claude Code quay về OAuth login gốc.
> Alias tương thích ngược: `original` / `direct` / `clear` → `subscription`.

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

## 2. Điền key (mỗi target 1 key riêng — chỉ điền cái bạn xài)

`setup.sh` hỏi key từng target (Enter để bỏ qua cái không dùng). Hoặc điền sau:

```bash
# mac/linux — nhập ẩn rồi apply luôn. claude + deepseek dùng CÙNG 1 key 9router.
ccswitch set-key claude       # key cho Claude qua 9router
ccswitch set-key deepseek     # DeepSeek qua 9router — điền cùng token với claude
```

Hoặc sửa file trực tiếp:

```bash
$EDITOR ~/.claude/profiles/deepseek.json     # thay <your-9router-key>
```
```powershell
notepad $env:USERPROFILE\.claude\profiles\deepseek.json
```

> 🔑 Xin key từ lead. `claude` + `deepseek` **chung 1 token** (điền giống nhau vào cả 2 file). **Không commit key** — file `~/.claude/profiles/*.json` là local, không đẩy git.

---

## 3. Dùng

```bash
ccswitch                # xem target đang active (theo model prefix) + health + subscription note
ccswitch claude         # → Claude qua 9router (default)
ccswitch deepseek       # → DeepSeek qua 9router
ccswitch subscription   # → gỡ env block, dùng OAuth subscription login
ccswitch spawn <target> # → mở 1 instance RIÊNG ghim target đó (settings.json không đổi)
ccswitch check          # probe health cả 2 profile + verify subscription OAuth
ccswitch fallback       # giữ target đang active nếu router healthy; router chết → subscription
ccswitch set-key [t]    # nhập key mới (ẩn) cho target t (default claude) rồi apply
ccswitch clear          # alias của subscription (gỡ block env)
ccswitch help           # (hoặc -h) in bảng lệnh + target đầy đủ
```

Windows: cú pháp giống hệt (`ccswitch claude`, ...).

> ⚠️ **Sau mỗi lần switch phải RESTART Claude Code** (quit + mở lại) — env chỉ load lúc khởi động.

### Auto-switch khi timeout/lỗi

Hook `SessionStart` (`hooks/check-router.sh`) probe endpoint đang active mỗi lần mở session. Nếu nó **timeout hoặc lỗi** (health ≠ 200), hook **tự chạy `ccswitch fallback`** → ghi profile healthy đầu tiên vào `settings.json`.

- **Giới hạn:** env nạp lúc process start, **trước** hook → switch heal cho lần mở **kế tiếp**; session hiện tại có thể còn endpoint cũ tới khi Reload Window / restart.
- **Mid-session** (đang chat mà API lỗi) **không** auto-switch được (Claude Code không có hook on-error) — đó là việc của router upstream-failover.
- **Tắt auto-switch** (chỉ cảnh báo như cũ): `export CCSWITCH_NO_AUTO=1`.

Ví dụ output `ccswitch`:
```
── effective source (Claude Code precedence §2) ──
▶ ③ settings.json  →  claude (https://9router.acegalaxy.co/v1, cc/claude-opus-4-8)
── các tầng khác ──
  claude: 200 OK
  deepseek: 200 OK
  subscription: ✓ logged in (you@acegalaxy.co, max) [keychain] → safe-harbor OK
profiles: claude deepseek
```

### Chạy nhiều vendor SONG SONG

`ccswitch <target>` chỉ đổi **1 instance** — 1 process Claude Code đọc 1 block `env` → 1 model. Muốn **cả 2 vendor cùng active** thì cần **2 process riêng**. Dùng `spawn` (hoặc 2 alias `setup` tạo sẵn):

```
# mỗi lệnh trong 1 terminal riêng → 2 vendor chạy đồng thời
claude-cc      # = ccswitch spawn claude    → Claude (cc/*)
claude-ds      # = ccswitch spawn deepseek  → DeepSeek (ds/*)
```

`spawn` export model vào **process env** (tầng ① — thắng mọi settings file) rồi gọi `claude`, nên **KHÔNG đụng `settings.json`** — target đang switch-in-place của bạn giữ nguyên. Không cần restart: mỗi instance sinh ra đã pin sẵn vendor.

> ⚠️ **Quota chung.** 2 target cùng đi qua 1 account 9router (chung 1 key) → **share chung 1 quota**. Chạy 2 song song = đốt quota nhanh gấp ~2. Chung 1 token, KHÔNG tách quota (1 email = 1 quota); tách thật cần account 9router khác email.
>
> `spawn subscription` bị từ chối — subscription là env-clear (gỡ block), không có gì để export. Muốn subscription thì `ccswitch subscription` rồi chạy `claude` thường.

---

## 4. Model — prefix theo target

Model qua 9router **phải** có prefix. Mỗi profile map sẵn 4 tier (Opus/Sonnet/Haiku/Fable) vì Claude Code luôn request theo tier:

| Target | Prefix | Ví dụ (Opus tier) |
|---|---|---|
| `claude` | `cc/` (claude) | `cc/claude-opus-4-8` |
| `deepseek` | `ds/` | `ds/deepseek-v4-pro-max` |

Thiếu prefix → lỗi `model_not_found`. Xem model id đầy đủ trong `~/.claude/profiles/<target>.json`, hoặc list live: `curl -s https://9router.acegalaxy.co/v1/models -H "Authorization: Bearer <key>" | jq -r '.data[].id'`. (Ở `subscription` — không có env block — Claude Code tự dùng model mặc định của tài khoản, không cần prefix.)

---

## 5. Troubleshoot

**`ccswitch` báo `claude: 000 DOWN` nhưng endpoint vẫn sống**
Thường do **IPv6 route hỏng** — host resolve ra cả A (IPv4) + AAAA (IPv6), nhưng path IPv6 timeout. Claude Code (Node) tự né sang IPv4 nên vẫn chạy; chỉ `curl`/health-probe bị kẹt. Xác minh:
```bash
curl -4 --resolve 9router.acegalaxy.co:443:172.66.43.28 https://9router.acegalaxy.co/v1/models -H "Authorization: Bearer <key>"
```
Nếu IPv4 trả `200` → endpoint OK, bỏ qua cảnh báo. Muốn dứt điểm: pin IPv4 vào `/etc/hosts`.

**`No active credentials for provider` / `model_not_found`**
Sai model id — thêm prefix đúng target (`cc/` claude, `ds/` deepseek — xem mục 4).

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
    ├── claude.json            # claude cc/*
    └── deepseek.json          # deepseek ds/*  (same key as claude.json)
                               # subscription không có file — nó là env-clear
```
