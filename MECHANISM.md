# ccswitch — Cơ chế & Setup (dev handoff)

> Tài liệu kỹ thuật đầy đủ cho team dev. README.md là quickstart cho người dùng cuối; file này giải thích **cơ chế bên trong**, **auto-switch**, **giới hạn**, và **cách test**.
>
> **Last updated:** 2026-07-15

---

## 1. ccswitch là gì

CLI đổi endpoint auth của **Claude Code** giữa nhiều "profile" — chỉ thay block `env` trong `settings.json`, giữ nguyên phần còn lại (hooks, permissions, statusLine…).

4 target (theo thứ tự ưu tiên fallback):

| Target | Cơ chế | Vai trò |
|---|---|---|
| `claude` | `env` = base 9router + token + model `cc/*` | ⭐ DEFAULT — claude qua remote router |
| `deepseek` | cùng base 9router + **cùng token** + model `ds/*` | DeepSeek qua 9router |
| `subscription` | **gỡ block `env`** khỏi `settings.json` | Safe-harbor fallback (cuối cùng) — Claude Code dùng OAuth subscription login, **không cần key** |

`claude` / `deepseek` dùng **CÙNG base URL** `https://9router.acegalaxy.co/v1` qua 9router **và CÙNG 1 token** (điền giống nhau vào cả 2 profile); chỉ khác block `ANTHROPIC_DEFAULT_*_MODEL` (prefix `cc/` vs `ds/`). Vì chung 1 router, router chết = cả 2 chết → fallback duy nhất là `subscription`.

> **Phân biệt target:** URL 2 profile giống nhau nên `current()`/hook không đọc URL để nhận diện — đọc **model prefix** (`.env.ANTHROPIC_DEFAULT_OPUS_MODEL` trong settings.json): `ds/*`=deepseek, `cc/*`=claude.
>
> _(Đã bỏ `codex`/GPT `cx/*`: 9router trả raw OpenAI wire format cho `cx/*`, Claude Code không parse được — xem changelog 2026-07-16.)_

`subscription` KHÔNG phải profile file — nó là *sự vắng mặt* của block `env`. Không có URL để probe, không có key; là terminal luôn về được. Alias tương thích ngược: `original` / `direct` / `clear` → `subscription`.

> **2026-07-15:** (a) tier `local` (`http://127.0.0.1:20128/v1`) đã gỡ. (b) fallback đổi từ `original` (Anthropic-direct + `ANTHROPIC_API_KEY`) → `subscription` (clear env / OAuth) — đồng bộ với chủ trương "fallback luôn dùng subscription, không dùng API key".

---

## 2. Claude Code đọc endpoint từ đâu — thứ tự ưu tiên (QUAN TRỌNG)

Đây là điểm hay gây nhầm. Claude Code lấy `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` theo thứ tự (cao → thấp):

```
1. Process env      (biến shell export TRƯỚC khi chạy `claude`)   ← THẮNG TẤT CẢ
2. settings.local.json  .env   (project-scoped, gitignored)
3. settings.json        .env   (project shared, hoặc ~/.claude global)
4. (không có) → Claude Code OAuth subscription login mặc định
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
    ├── claude.json       # claude cc/*
    └── deepseek.json     # deepseek ds/*  (cùng key với claude.json; subscription không có file — env-clear)
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
ccswitch              # effective source (tầng nào đang thắng §2, tag theo model prefix) + health + verify subscription
ccswitch claude       # switch → Claude qua 9router (cc/*)
ccswitch deepseek     # switch → DeepSeek qua 9router (ds/*)
ccswitch subscription # gỡ block env → Claude Code OAuth subscription login
ccswitch check        # probe health cả 2 profile + verify subscription
ccswitch fallback     # giữ target đang active nếu router healthy; router chết → subscription (safe-harbor)
ccswitch set-key [p]  # nhập key mới (ẩn) cho profile p (mặc định claude; token độc lập từng target) rồi apply
ccswitch clear        # alias của subscription (gỡ block env)
```

Mỗi lần `apply`/clear tạo backup `settings.json.bak`. Health probe:
- Router (`9router`): `GET {base}/models` + `Authorization: Bearer <token>`. Timeout 4s → coi như `000` (down).
- `subscription`: KHÔNG probe HTTP (không có URL/key — là env-clear) NHƯNG **verify OAuth credential** để biết safe-harbor có thật sự cứu được không (§6 điều kiện):
  - mac → Keychain service `Claude Code-credentials`
  - linux → `~/.claude/.credentials.json`
  - Có credential → `✓ logged in (email, subscriptionType) [nguồn]`. Email lấy từ `~/.claude.json` `.oauthAccount`, `subscriptionType` từ credential.
  - Không → `✗ NO OAuth credential — safe-harbor will prompt login on first use`. Đây là cảnh báo thật: nếu fallback về subscription mà chưa từng login, Claude sẽ hiện màn đăng nhập.
  - KHÔNG in token — chỉ metadata.

---

## 5. Auto-switch khi timeout / lỗi

Hook `hooks/check-router.sh` chạy ở sự kiện **SessionStart** (đã wire vào `settings.json` bởi `setup.sh`).

**Banner (LUÔN in đầu session):** mỗi lần mở session hook in ngay: endpoint đang chạy (đọc `$ANTHROPIC_BASE_URL` env — endpoint session thực dùng — fallback settings.json), thứ tự fallback, và lệnh sơ lược. Ví dụ:

```
━━━ ccswitch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ Endpoint đang chạy: claude (via 9router)  (https://9router.acegalaxy.co/v1)
  Fallback (khi router chết): claude/deepseek → subscription (OAuth)
    • subscription = safe-harbor: gỡ env → Claude Code dùng OAuth login (luôn về được)
  Lệnh: ccswitch [check | claude | deepseek | subscription | fallback | clear]
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
   ├─ router hiện tại (claude/deepseek) healthy? → apply, xong
   └─ router chết → apply `subscription` (gỡ block env, safe-harbor, KHÔNG probe)
        → Claude Code dùng OAuth subscription login, không bao giờ kẹt trên router chết
        → không cần key: subscription là env-clear, luôn thành công
```

### Giới hạn (đọc kỹ — tránh hiểu nhầm)

1. **Không heal session hiện tại ngay.** Env nạp lúc process launch, **trước** khi hook chạy. Switch trong hook ghi `settings.json` cho lần mở **kế tiếp**. Session đang mở vẫn dùng endpoint cũ đến khi **Reload Window / restart Claude Code**. → lần đầu gặp outage bạn mất 1 nhịp; các session sau tự đúng.
2. **Không cover mid-session.** Đang chat mà API timeout/lỗi → hook KHÔNG chạy lại (nó chỉ ở SessionStart). Claude Code không expose hook "on API error". Muốn zero-downtime giữa phiên → phải để **router upstream-failover** lo (việc của service router, không phải ccswitch).
3. **Chỉ engage khi đang ở router.** Nếu đang `subscription` (không có env block) thì hook bỏ qua — không có "cấp trên" để fallback tới.

### Tắt auto-switch (về warn-only)

```bash
export CCSWITCH_NO_AUTO=1
```

---

## 6. Fallback chain & safe-harbor (KHÔNG để Claude chết)

Thứ tự: **router hiện tại (claude/deepseek) → subscription**.

- **router (claude/deepseek)**: giữ target đang active nếu probe **200** (fallback không ép về claude khi bạn đang ở deepseek).
- **`subscription` = SAFE-HARBOR cuối cùng**: nếu router chết, `fallback` **luôn apply `subscription`** = gỡ block `env` khỏi `settings.json`. Không probe, không cần key. Claude Code quay về **OAuth subscription login gốc** → luôn về được, không bao giờ kẹt trên router chết. (2 target chung 1 router 9router → router chết là cả 2 chết.)

- ✅ Đã test (xem §8): fallback bỏ qua router chết rồi gỡ env block; `settings.json` không còn `.env` → Claude Code dùng subscription.

⚠️ **Điều kiện để safe-harbor thật sự cứu Claude:** máy đã **đăng nhập OAuth subscription** (chạy `claude` + login ít nhất 1 lần). subscription chỉ gỡ endpoint override — nó KHÔNG tự tạo phiên login. Nếu chưa từng login, Claude Code sẽ nhắc đăng nhập lần đầu.

```bash
ccswitch subscription   # gỡ env block
claude                  # nếu chưa login → làm theo prompt OAuth
```

Không có key nào để điền — đây chính là điểm khác `original` cũ: fallback dùng subscription (OAuth), không dùng `ANTHROPIC_API_KEY`.

---

## 6b. Chạy nhiều vendor song song (`spawn`)

`ccswitch <target>` sửa 1 block `env` trong `settings.json` → **1 instance = 1 model**. 2 vendor active cùng lúc là **bất khả trong 1 process** (nó chỉ đọc 1 `ANTHROPIC_DEFAULT_OPUS_MODEL`). Muốn song song → **nhiều process**, mỗi cái pin 1 vendor.

`spawn` dựa vào **precedence §2**: process env là **tầng ①**, thắng mọi settings file. Nên thay vì ghi `settings.json`, `spawn` export model vào env của chính shell rồi `exec claude`:

```text
spawn deepseek:
  1. đọc profiles/deepseek.json
  2. export ANTHROPIC_BASE_URL / _AUTH_TOKEN / _DEFAULT_*_MODEL  (ds/*)  vào process env
  3. printf title "claude:deepseek"  (phân biệt terminal)
  4. exec claude   → instance mới thừa kế env → chạy DeepSeek
```

`settings.json` **không bị đụng** → switch-in-place hiện tại (dù đang ở target nào) giữ nguyên. Không cần restart: instance vừa sinh đã pin sẵn.

```text
Terminal 1: claude-cc   (spawn claude)   → process env cc/*  → Claude    } 2 vendor
Terminal 2: claude-ds   (spawn deepseek) → process env ds/*  → DeepSeek  } đồng thời
                         settings.json    ← KHÔNG đổi (vẫn target switch-in-place cũ)
```

- `subscription` **không spawn được**: nó là env-clear (gỡ block), không có gì để export → `spawn subscription` báo lỗi, hướng dẫn dùng `ccswitch subscription` + `claude` thường.
- Binary resolve qua `command -v claude` (fallback `~/.local/bin/claude`) — **không** dựa alias `claude` (user có thể có alias cũ bị override).
- Alias tiện: `setup` tạo `claude-cc` / `claude-ds` (short-name cc/ds).

⚠️ **Quota chung.** 2 target = 1 account 9router = **1 quota**. Song song 2 = đốt nhanh ~2×. Chung 1 token, KHÔNG tách quota (1 email = 1 quota). Tách thật cần account 9router khác email — ngoài phạm vi ccswitch.

---

## 7. Setup

### macOS / Linux

```bash
cd ccswitch-cli-claude
bash setup.sh
# điền token: $EDITOR ~/.claude/profiles/claude.json
source ~/.zshrc && ccswitch claude
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

### 8.2 Fallback tới safe-harbor: 9router chết → gỡ env block

Ý tưởng: cho 9router trỏ port chết → xác nhận fallback gỡ block `env` (subscription), `settings.json` không còn `.env`.

```bash
T=$(mktemp -d)/home; mkdir -p "$T/.claude/profiles" "$T/.claude/hooks"
cp ccswitch.sh "$T/.claude/ccswitch.sh"; chmod +x "$T/.claude/ccswitch.sh"
cp hooks/check-router.sh "$T/.claude/hooks/"; chmod +x "$T/.claude/hooks/check-router.sh"
printf '{"ANTHROPIC_BASE_URL":"https://9router.acegalaxy.co:9/v1","ANTHROPIC_AUTH_TOKEN":"x"}\n' > "$T/.claude/profiles/9router.json"
printf '{"permissions":{"allow":["Bash(*)"]},"env":{"ANTHROPIC_BASE_URL":"https://9router.acegalaxy.co:9/v1"}}\n' > "$T/.claude/settings.json"

HOME="$T" bash "$T/.claude/hooks/check-router.sh"
jq -e '.env == null' "$T/.claude/settings.json" && echo "PASS: env block removed"   # EXPECT: PASS
jq -e '.permissions != null' "$T/.claude/settings.json" && echo "PASS: rest intact"  # phần còn lại giữ nguyên
```

Kết quả mong đợi: hook in `router (...) health=... — có thể đang DOWN` rồi auto-switch `→ safe-harbor: subscription (OAuth)`, và `settings.json` mất `.env` nhưng giữ nguyên `permissions`/hooks. → **fallback safe-harbor chạy đúng**.

### 8.3 set-key subscription bị từ chối

```bash
HOME="$T" bash "$T/.claude/ccswitch.sh" set-key subscription; echo "exit=$?"
# EXPECT: ❌ ... no key to set ... + exit=1
```

### 8.4 Tắt auto-switch

```bash
HOME="$T" CCSWITCH_NO_AUTO=1 bash "$T/.claude/hooks/check-router.sh"
# EXPECT: chỉ cảnh báo, KHÔNG switch
```

> subscription là env-clear (OAuth) — không cần key nào để test. Mock server không còn cần thiết như bản `original` cũ.

### 8.5 Codex / DeepSeek target — apply đúng model prefix + tag đúng tên

```bash
T=$(mktemp -d)/home; mkdir -p "$T/.claude/profiles"
cp ccswitch.sh "$T/.claude/ccswitch.sh"; chmod +x "$T/.claude/ccswitch.sh"
for p in claude deepseek; do cp profiles/$p.json "$T/.claude/profiles/"; done
printf '{"permissions":{"allow":["Bash(*)"]}}\n' > "$T/.claude/settings.json"

# apply claude → settings.json có model cc/*
HOME="$T" bash "$T/.claude/ccswitch.sh" claude >/dev/null
jq -e '.env.ANTHROPIC_DEFAULT_OPUS_MODEL | startswith("cc/")' "$T/.claude/settings.json" >/dev/null && echo "PASS: claude applied (cc/*)"
# status phân biệt đúng claude qua model prefix (KHÔNG qua URL — 2 base giống nhau)
HOME="$T" bash "$T/.claude/ccswitch.sh" status | grep -qi 'claude' && echo "PASS: current tags claude"

# apply deepseek → ds/*
HOME="$T" bash "$T/.claude/ccswitch.sh" deepseek >/dev/null
jq -e '.env.ANTHROPIC_DEFAULT_OPUS_MODEL | startswith("ds/")' "$T/.claude/settings.json" >/dev/null && echo "PASS: deepseek applied (ds/*)"
```

Kết quả mong đợi: 3 dòng PASS. Xác nhận target phân biệt bằng model prefix, không phải URL (2 profile chung base 9router).

### 8.6 `spawn` — export đúng model prefix + KHÔNG đụng settings.json

```bash
T=$(mktemp -d)/home; mkdir -p "$T/.claude/profiles" "$T/bin"
cp profiles/deepseek.json "$T/.claude/profiles/"
sed -i '' 's/<your-9router-key>/sk-test/' "$T/.claude/profiles/deepseek.json" 2>/dev/null || \
  sed -i 's/<your-9router-key>/sk-test/' "$T/.claude/profiles/deepseek.json"
cp ccswitch.sh "$T/.claude/ccswitch.sh"

# stub `claude` in dumps ANTHROPIC_* env → chứng minh spawn export ds/*
printf '#!/usr/bin/env bash\nenv | grep ^ANTHROPIC_ | sort\n' > "$T/bin/claude"; chmod +x "$T/bin/claude"
HOME="$T" PATH="$T/bin:$PATH" bash "$T/.claude/ccswitch.sh" spawn deepseek 2>&1 \
  | grep -q 'ANTHROPIC_DEFAULT_OPUS_MODEL=ds/deepseek-v4-pro-max' && echo "PASS: spawn exports ds/*"

# spawn subscription → reject
HOME="$T" bash "$T/.claude/ccswitch.sh" spawn subscription 2>&1 \
  | grep -qi 'subscription\|real target' && echo "PASS: spawn subscription rejected"

# settings.json KHÔNG bị đụng bởi spawn
printf '{"env":{"ANTHROPIC_DEFAULT_OPUS_MODEL":"cc/claude-opus-4-8"}}\n' > "$T/.claude/settings.json"
b=$(cat "$T/.claude/settings.json")
HOME="$T" PATH="$T/bin:$PATH" bash "$T/.claude/ccswitch.sh" spawn deepseek >/dev/null 2>&1
[ "$b" = "$(cat "$T/.claude/settings.json")" ] && echo "PASS: settings.json untouched by spawn"
```

Kết quả mong đợi: 3 dòng PASS. `spawn` chỉ tác động process env, giữ nguyên settings switch-in-place.

---

## 9. Troubleshoot

| Triệu chứng | Nguyên nhân / xử lý |
|---|---|
| Switch xong không đổi | Chưa restart Claude Code. Quit hẳn rồi mở lại. |
| `env | grep ANTHROPIC` có giá trị lạ | Process env đang đè settings (§2). `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN` hoặc quit hẳn VSCode/terminal rồi mở lại. |
| `check` báo `000 DOWN` nhưng endpoint sống | IPv6 route hỏng — Node né sang IPv4 nên vẫn chạy; chỉ curl kẹt. Verify: `curl -4 ... /v1/models`. Muốn dứt điểm: pin IPv4 vào `/etc/hosts`. |
| `model_not_found` | Với 9router model phải có prefix `cc/` (vd `cc/claude-opus-4-8`). Ở `subscription` (env-clear) Claude Code tự dùng model tài khoản, không prefix. |
| Sau `ccswitch subscription` Claude đòi login | subscription = OAuth; máy chưa từng login. Chạy `claude` + làm theo prompt đăng nhập. Không có key để điền. |
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

- **2026-07-16** — **Bỏ target `codex` (`cx/*` GPT).** 9router trả **raw OpenAI wire format** cho `cx/*` (`.choices[].message.content`) trong khi Claude Code chỉ parse Anthropic Messages (`.content[].text`) → codex active làm session vỡ (verified qua `/v1/messages` probe: cả 3 `cx/*` model đều OPENAI-raw; `cc/*` + `ds/*` đều ANTHROPIC-native OK). Xoá `profiles/codex.json` + mọi ref `codex`/`cx/` khỏi `ORDER`, `canon`/`tag`, dispatch case, `active_router_profile`, spawn-die, usage, banner, verify sandbox §8.5/§8.6. **Đổi model design:** `claude` + `deepseek` giờ **chung 1 token 9router** (điền cùng key vào cả 2 profile) — bỏ "token độc lập per-target" của 2026-07-15e (vì cùng 1 account 9router = 1 quota, token riêng vô nghĩa). Files: `ccswitch.sh` + `ccswitch.ps1` + `hooks/check-router.sh` + `setup.sh` + `setup.ps1` + README + MECHANISM. Thêm lại `codex` khi 9router có lớp dịch cx/* → Anthropic format.
- **2026-07-15g** — **`spawn <target>` — chạy nhiều vendor SONG SONG.** Single-instance switch chỉ giữ 1 vendor active (1 process → 1 env → 1 model). `spawn` export model từ `profiles/<target>.json` vào **process env** (tầng ① precedence §2) rồi `exec claude`, **KHÔNG đụng `settings.json`** → mở N terminal + spawn N target = N vendor đồng thời. `subscription` bị từ chối (env-clear, không có gì export). Binary resolve qua `command -v claude` (không dựa alias). `setup` wire 3 alias `claude-cc`/`claude-cx`/`claude-ds`. Cảnh báo quota chung (1 account 9router = 1 quota). Thêm §6b + §8.6. Parity `.ps1` (`Spawn-Target` + case) + `setup.ps1` (3 launcher function).

- **2026-07-15f** — **Rename target `9router` → `claude`** (đặt tên theo model family cho khớp `codex`/`deepseek`, không theo transport). Bỏ hẳn tên `9router` làm target — **KHÔNG** giữ alias (gõ `ccswitch 9router` giờ là unknown → usage error). Đổi: `profiles/9router.json` → `profiles/claude.json` (git mv), `ORDER=(claude codex deepseek)`, `active_router_profile` default `claude`, dispatch `claude|codex|deepseek)`, `set-key` default `claude`, `tag()` → `claude`/`codex`/`deepseek` thuần (transport hiện ở dòng URL), usage/banner/hint. **GIỮ nguyên:** hostname `9router.acegalaxy.co` (URL router thật) + key placeholder `<your-9router-key>` + chữ "via 9router" mô tả transport. Files: `ccswitch.sh` + `ccswitch.ps1` + `hooks/check-router.sh` + `setup.sh` + `setup.ps1` + README + MECHANISM. Verify sandbox §8.5 (apply cc/, tag `claude`, old name `9router` → exit 1). **Parity note:** `setup.ps1` mới rename filename, vẫn wire 1 profile `claude` (codex/deepseek trên Windows copy tay) — cùng lag `probe_subscription` 2026-07-15c.
- **2026-07-15e** — Thêm 2 target router **`codex`** (`cx/*` GPT) + **`deepseek`** (`ds/*`) qua CÙNG 9router. Chung base URL, khác block `ANTHROPIC_DEFAULT_*_MODEL`; mỗi profile **token độc lập** (user có thể chỉ xài 1). `ORDER=(9router codex deepseek)`; `current()`/`tag()`/hook phân biệt target bằng **model prefix** (không phải URL — 3 base giống nhau); dispatch case `codex)`/`deepseek)`; `fallback` giữ router đang active (đọc model prefix từ settings.json) rồi mới về subscription; `set-key <target>` ghi token riêng từng profile (không share). `setup.sh` copy 3 profile + prompt token per-target (Enter để skip cái không dùng). Files: `profiles/{codex,deepseek}.json` (new) + `ccswitch.sh` + `ccswitch.ps1` + `hooks/check-router.sh` + `setup.sh` + README + MECHANISM. Verify sandbox §8.5. **Parity note:** `.ps1` đã có ORDER/dispatch/fallback/tag; riêng `probe_subscription` (2026-07-15c) `.ps1` vẫn TODO.
- **2026-07-15d** — `ccswitch` (status) giờ **show tầng nguồn đang thắng** thay vì chỉ đọc `settings.json`. `current()` resolve theo precedence §2: ① process env → ② settings.local.json → ③ settings.json → ④ subscription; đánh dấu `▶` tầng effective + cảnh báo khi ① process env đè settings (bẫy §9), liệt kê cả các tầng khác. Caveat: ① chỉ thấy nếu ccswitch chạy trong shell có sẵn biến — nhắc verify `env | grep ANTHROPIC_BASE_URL`. Cập nhật §4. **TODO parity:** `ccswitch.ps1` chưa có tương đương.
- **2026-07-15c** — `ccswitch check` (+ `status`) giờ **verify subscription safe-harbor** thay vì in dòng cứng "no probe". Thêm hàm `probe_subscription()` trong `ccswitch.sh`: đọc OAuth credential (mac Keychain `Claude Code-credentials` / linux `~/.claude/.credentials.json`), in `✓ logged in (email, subscriptionType) [nguồn]` hoặc `✗ NO OAuth credential — will prompt login`. Email từ `~/.claude.json` `.oauthAccount`, không in token. Verify sandbox: keychain ✓, no-cred ✗, linux-file ✓. Cập nhật §4 + comment header. **TODO parity:** `ccswitch.ps1` chưa có tương đương (Windows dùng `cmdkey`/DPAPI cho credential — cần impl riêng); hiện `.ps1` vẫn in dòng cứng.
- **2026-07-15b** — Fallback đổi `original` (Anthropic-direct + `ANTHROPIC_API_KEY`) → `subscription` (gỡ block `env` → Claude Code OAuth login). Chủ trương: fallback luôn dùng subscription, KHÔNG dùng API key. Xóa `profiles/original.json` + mọi đường `ANTHROPIC_API_KEY`/`x-api-key`/`api.anthropic.com`. Thêm lệnh `ccswitch set-key [profile]` (nhập key ẩn → apply) + prompt nhập key 9router trong `setup.sh`/`setup.ps1`. Alias `original`/`direct`/`clear` → `subscription`. Cập nhật `ccswitch.sh` + `ccswitch.ps1` + `hooks/check-router.sh` + `setup.sh` + `setup.ps1` + README + MECHANISM. Verify sandbox (§8): fallback gỡ env block, giữ nguyên phần còn lại; `set-key subscription` bị từ chối.
- **2026-07-15** — Remove tier `local` (`:20128`): đồng bộ 2-tier (`9router → original`) khớp launcher `scripts/9router-claude.sh` ở Nexus root. Bỏ alias `router` (giữ `direct → original`). Xóa `profiles/local.json`. Cập nhật `ccswitch.sh` + `ccswitch.ps1` + `hooks/check-router.sh` + `setup.sh` + `setup.ps1` + README + MECHANISM. Verify sandbox test 2-tier (§8).
- **2026-07-14** — Auto-switch: hook `check-router.sh` nâng từ warn-only → tự `ccswitch fallback` khi timeout/lỗi (tắt bằng `CCSWITCH_NO_AUTO=1`). Thêm lệnh `ccswitch clear`. Probe fix header `anthropic-version` cho `original`. Fix hiển thị health `000` (trước bị `000000`). Parity PowerShell (probe header + `clear`). Verify bằng sandbox test (§8).
- **Init** — ccswitch CLI 9router/local/original + warn-only SessionStart hook + cross-platform setup.
