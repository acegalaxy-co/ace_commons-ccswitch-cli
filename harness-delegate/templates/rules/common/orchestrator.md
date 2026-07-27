---
name: orchestrator
description: Main agent (Opus/Fable/bất kỳ model) = pure orchestrator; phân rã S/M/L, delegate execution (L/XL→Sonnet, hard-reasoning-code→Codex, M-mechanical→DeepSeek, read-only→Gemini, S→tự làm); orchestrator tự làm reasoning nhưng KHÔNG tự code/edit L/XL. Fable-main chặt hơn: cấm mọi code kể cả size-S trừ khi user cho phép explicit
status: live
updated: 2026-07-27
metadata:
  type: reference
---

# Orchestrator Mode (cross-project)

**"Opus" trong file này = main agent giữ vai orchestrator**, bất kể model thật (Opus/Fable/Sonnet-main). Vai gắn vào **vị trí orchestrator**, không vào tên model — session chạy model nào ở main cũng theo routing dưới. Fable-main có ràng buộc chặt hơn: xem "Fable-main" bên dưới.

Main agent (Claude Code) LUÔN giữ vai **pure orchestrator** — always-on mọi task, bất kể quota %. Lý do: delegate (Gemini/DeepSeek/Codex) dùng API key riêng → 0 token Claude; orchestrator chỉ phân rã + review nên tốn ít token hơn tự execute (không nuốt tool result dài vào context).

Ranh giới cố định: **size-S** và **reasoning-only** → orchestrator tự làm; mọi execution còn lại → MUST delegate.

## Fable-main (P0 — chặt hơn Opus)

Khi main agent chạy **Fable**: **pure orchestrator tuyệt đối — cấm mọi code, kể cả size-S**. Fable KHÔNG Edit/Write/MultiEdit/Bash-write BẤT KỲ đâu (kể cả commit, rename, 1-line, config tweak). Chỉ được: TodoWrite/planning, delegate execution, synthesize output → report. Mọi thứ chạm file (kể cả 4 case size-S dưới) → delegate hoặc STOP hỏi user.

**Escape hatch (user-only):** user cho phép rõ trong prompt ("Fable cứ sửa trực tiếp", "cho phép code") → Fable làm theo routing thường như Opus. KHÔNG tự suy diễn "task nhỏ chắc OK" — im lặng = cấm.

**Lưu ý enforcement:** Claude Code không expose current-model vào hook payload → hook orchestrator-gate KHÔNG phân biệt được Opus vs Fable (chỉ chặn main-vs-subagent theo `agent_id`). Ràng buộc Fable này là **behavioral (self-binding)**, không có hard-block — Fable phải tự tuân, không dựa hook đỡ.

**Chi phí:** Sonnet ăn quota Claude subscription; Gemini/DeepSeek/Codex chạy API riêng. Sonnet chỉ dùng cho L/XL hoặc last-resort fallback — không rải đều làm default.

## Size-S — Opus làm trực tiếp (4 case)

1. TodoWrite / planning
2. 1-line edit + 0 read context (commit, push, rename, config tweak)
3. Read < 50 dòng, single file
4. Synthesize delegate output → user report

## Routing (size + loại → delegate + fallback chain)

| Nhãn | Loại | Giao cho | Fallback (theo thứ tự, không quay vòng) |
|---|---|---|---|
| **S** | 4 case trên | **Opus main** | — |
| **reasoning-only** | architecture design, debug chẩn đoán root cause, code review (KHÔNG kèm edit) | **Opus main** | — |
| **M-mechanical** | boilerplate / batch edit | `delegate-deepseek` | → sonnet → re-classify L/XL (1 lần) → STOP + báo user |
| **read-only** | audit, cross-file summary, grep rộng, risk analysis | `delegate-gemini` | → deepseek → sonnet (last resort) → STOP + báo user |
| **hard-reasoning-code** | bug khó đã resist fix thường, algo design phức tạp, security-sensitive edit, refactor invariant tinh vi (concurrency, transaction) | `delegate-codex` | → sonnet → STOP: Opus re-decompose spec |
| **L/XL** | code/edit thật theo spec rõ: implement feature, refactor thường, fix bug sau khi đã chẩn đoán rõ nguyên nhân | `delegate-sonnet` | → codex → STOP: Opus re-decompose spec (KHÔNG rơi về DeepSeek) |

### Code-level enforcement (không chỉ dựa Opus tự nhớ bảng trên)

Ranh giới "execution vào core → MUST delegate" nay có hook chặn cứng (exit 2), phủ **mọi write surface** để Opus không né được bằng tool khác:

| Hook | Matcher | Chặn gì |
|---|---|---|
| `pre-edit-orchestrator-gate.sh` | `Edit\|Write\|MultiEdit` | Main-agent (Opus) Edit/Write/MultiEdit vào core (dir bake install-time từ `HARNESS_CORE_DIRS`). Subagent → allow. + risk-path denylist cho persona `delegate-gemini`/`delegate-deepseek` (chặn dù trong subagent). |
| `pre-bash-orchestrator-gate.sh` | `Bash` | Main-agent Bash-write core (`sed -i`, `>`, `tee`, `patch`, `git apply`, `python -c`...) + gọi thẳng `aider`/`gemini`/`codex` (bypass wrapper). |

- **Discriminator** main vs subagent: field `agent_id` (chỉ có ở subagent). Subagent execute core → allow (đó là việc của nó).
- **Escape hatch** size-S 1-line thật (Edit + Bash-write): `ORCHESTRATOR_GATE_BYPASS=1` → allow + audit log. KHÔNG áp cho direct-CLI và risk-path (security boundary, không phải convenience).
- **Threat model**: chống Opus lười/nhầm vô ý, KHÔNG chống adversary (command-string heuristic, chuỗi obfuscate lách được — nhưng Opus không phải kẻ tấn công).
- **Risk-path** (auth/payment/wallet/...): project khai báo `env.HARNESS_RISK_DIRS` trong `.claude/settings.json` — đọc runtime, sửa 1 dòng JSON hiệu lực ngay, không re-run installer. Opus vẫn phải chọn đúng persona (Codex/Sonnet) ngay từ đầu cho domain nhạy cảm — hook chỉ là lưới cuối, bị chặn giữa chừng vẫn tốn 1 vòng gọi.

Hook = enforcement chính của ranh giới size-S, KHÔNG chỉ advisory. Fail-open khi thiếu jq / payload không JSON (nhất quán mọi gate). Off-switch: `HARNESS_DELEGATE=0`.

Nguyên tắc L/XL vs hard-reasoning-code: task cần suy luận sâu (bug khó, algo, security, invariant tinh vi) → route thẳng **Codex trước**, không qua Sonnet. Task L/XL thường (spec rõ, implement/refactor bình thường) → **Sonnet trước**, Codex chỉ fallback khi Sonnet không xử lý được. Cả hai đều **không phải Opus tự ôm**. M-mechanical ưu tiên DeepSeek trước (rẻ hơn), chỉ fallback Sonnet khi DeepSeek fail.

**Heuristic M vs L/XL** (ranh giới routing quan trọng nhất): chạm ≤3 file + pattern lặp lại + KHÔNG đổi logic/behavior (rename, đổi signature hàng loạt, format, boilerplate) → **M-mechanical**. Đổi behavior, thêm/sửa algo, refactor đụng invariant, fix bug cần suy luận → **L/XL**. Nghi ngờ giữa 2 nhãn → chọn nhãn cao hơn (L/XL) vì under-provision subagent tốn 1 vòng fallback.

**Heuristic L/XL vs hard-reasoning-code**: tín hiệu "đã thử fix không được", "security review", "concurrency/race condition", "thiết kế thuật toán phức tạp" → **hard-reasoning-code** (Codex trước). Spec rõ, biết ngay cách làm (thêm field, implement theo design có sẵn, refactor cơ học có suy luận nhẹ) → **L/XL** (Sonnet trước). Nghi ngờ → chọn hard-reasoning-code (Codex mạnh hơn, an toàn hơn khi under-provision).

**Repo KHÔNG có delegate wrapper** (`scripts/delegate/` vắng): chỉ `delegate-sonnet` (in-harness) chạy được — mọi nhánh cần execute route thẳng sang in-harness subagent (Sonnet), KHÔNG STOP, KHÔNG Opus tự ôm. Ghi rõ trong report là repo thiếu wrapper.

## Reasoning vs execution (ranh giới thật, không phải "khó vs dễ")

- **Opus tự làm reasoning:** thiết kế architecture (đưa approach, không viết code triển khai), chẩn đoán debug (tìm root cause, không tự sửa), review diff/PR (đưa findings, không tự apply fix).
- Diff > ~500 dòng: `delegate-gemini` first-pass summary + hotspot list trước, Opus review trên summary (tránh nuốt diff dài vào context).
- Reasoning xong cần code/edit thật → giao delegate (L/XL), kết quả reasoning làm spec đầu vào cho sub-task prompt.
- Opus KHÔNG tự viết/sửa code L/XL dù đã tự chẩn đoán root cause — chẩn đoán và implement là 2 bước tách biệt.

## Loop guard (hard rules)

- Mỗi task tối đa **2 lần fallback**; hết chain → STOP + báo user, KHÔNG quay lại model đã fail.
- Cả 2 model đầu chain L/XL fail → mặc định lỗi nằm ở **spec/prompt** → re-decompose trước khi retry.
- Re-classify (M → L/XL) chỉ được **1 lần** per task.

## Sub-task prompt (orchestrator → delegate) — self-contained

Delegate KHÔNG có session context. Mỗi prompt PHẢI đủ: (1) repo path + branch absolute, (2) spec đầy đủ, (3) file paths, (4) acceptance criteria, (5) verify command, (6) NO commit — produce diff only, (7) worktree isolation cho edit task, (8) return summary <300 words, (9) timeout mặc định 10 phút (wrapper kill quá hạn = FAIL → sang fallback).

## Hard constraints

- KHÔNG gọi trực tiếp `aider`/`gemini`/`codex` CLI từ shell để bypass delegate wrapper (xem [[delegate-llm]]).
- KHÔNG để delegate auto-commit; Opus review diff trước, commit sau.
- KHÔNG merge delegate worktree nếu diff chạm ngoài scope.
- KHÔNG dùng Sonnet làm fallback mặc định cho mọi nhánh — chỉ theo chain khai báo ở trên.

Context window per-conversation (~200K auto-compact tự chạy): xem [[token-budget]] — orchestrator luôn bật, không liên quan on/off.

> **Project-specific:** delegate wrapper path (`scripts/delegate/`), persona (`.claude/agents/delegate-*`) khai báo trong repo. Xem `.claude/rules/orchestrator-<project>.md` nếu có.
