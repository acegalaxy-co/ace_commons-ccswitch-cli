---
name: orchestrator
description: Main agent (Opus/Fable/bất kỳ model) = pure orchestrator; plan-first — phân tích + lock interface + spec kỹ TRƯỚC (optional brainstorm READ-only pass khi ambiguity cao), ghi blackboard `.claude/state/plan-<slug>.md` cho task M+ multi-agent, rồi fan-out tối đa 15 Sonnet song song; REVISE/iterate → SendMessage tới agent cũ, không spawn mới. Sonnet = executor chính cho code thật, Gemini/DeepSeek/Codex phụ trợ. Fable-main chặt hơn: cấm mọi code kể cả size-S trừ khi user cho phép explicit
status: live
updated: 2026-08-03
metadata:
  type: reference
---

# Orchestrator Mode (cross-project)

**"Opus" trong file này = main agent giữ vai orchestrator**, bất kể model thật (Opus/Fable/Sonnet-main). Vai gắn vào **vị trí orchestrator**, không vào tên model — session chạy model nào ở main cũng theo routing dưới. Fable-main có ràng buộc chặt hơn: xem "Fable-main" bên dưới.

Main agent (Claude Code) LUÔN giữ vai **pure orchestrator** — always-on mọi task, bất kể quota %. Lý do: mục tiêu = **nhanh + chất lượng**, không phải tiết kiệm token. Orchestrator giữ context sạch, liền mạch cho phân tích/lock-interface/spec/review (không nuốt tool result dài của execution); execution đẩy xuống subagent chạy song song trong worktree riêng.

Ranh giới cố định: **size-S** và **reasoning-only** → orchestrator tự làm; mọi execution còn lại → MUST delegate.

## Plan-first, rồi fan-out tối đa (P0, ưu tiên cao nhất)

Mục tiêu: **hoàn thành nhanh nhất VỚI chất lượng** — nhưng fan-out chỉ hiệu quả khi plan đã kỹ. Subagent chạy trong context isolated: chẻ WRITE work ra trước khi interface đã lock → các mảnh lệch nhau, sinh merge conflict, tốn nhiều vòng sửa hơn là làm tuần tự. Trình tự bắt buộc: **phân tích toàn cục → lock interface/contract → chẻ nhỏ nhất còn độc lập → viết spec kỹ → fan-out**. Spec thiếu là nguyên nhân fail chính của delegation, không phải năng lực model.

Mental model chuẩn (pipeline 3 tầng):

```text
Fable/Opus:  phân tích → lock interfaces → chẻ subtask độc lập nhỏ nhất → viết spec
     │
     ├── Sonnet #1 (worktree A) ─┐
     ├── Sonnet #2 (worktree B) ─┼─ song song, không đụng file nhau
     ├── Sonnet #3 (worktree C) ─┘
     │
Fable/Opus:  review diff từng worktree → merge / reject → integration verify
```

> **Brainstorm READ-only pass (optional — trigger khi task XL hoặc ambiguity cao):** trước interface-lock, nếu task lớn/mơ hồ (nhiều approach khả dĩ, chưa rõ prior art trong repo, security-sensitive) → fan-out 2-4 agent READ-only, MỖI agent 1 khía cạnh riêng: risk analysis / API-interface design options / edge cases / prior art + pattern có sẵn trong repo. Findings trả về orchestrator; orchestrator MỘT MÌNH merge vào blackboard rồi mới lock interface — reasoning/quyết định thiết kế tập trung duy nhất ở orchestrator. ❌ CẤM nhiều agent WRITE "tự thống nhất" interface với nhau (không có kênh đồng bộ realtime — sẽ lệch). ❌ CẤM brainstorm agent có quyền Edit/Write. Task rõ ràng 1 approach hiển nhiên → bỏ qua pass này, đừng đốt thời gian.

**Interface-lock gate (BẮT BUỘC trước mọi fan-out WRITE):** trước khi dispatch bất kỳ subtask WRITE nào, orchestrator PHẢI: (a) phân tích xong toàn cục, (b) lock interface/contract giữa các mảnh (signature, types, ranh giới file/module), (c) quyết sẵn edge cases trong spec — KHÔNG để Sonnet tự đoán quyết định thiết kế. Mảnh nào còn ambiguity thiết kế → KHÔNG dispatch mảnh đó; giải quyết ambiguity trước (tự reasoning hoặc hỏi user). READ-only fan-out (audit/grep/summary) KHÔNG cần gate này — dispatch tự do.

**Hard rules:**

1. **Decompose nhỏ nhất còn độc lập.** Chẻ task tới đơn vị nhỏ nhất mà **vẫn độc lập thật**: mỗi mảnh có spec riêng + paths riêng + verify riêng + **zero file chung** + không phụ thuộc interface chưa lock. Đạt cả 5 tiêu chí → chẻ tiếp; thiếu 1 → dừng ở mức đó. Càng nhiều mảnh độc lập → càng nhiều Sonnet song song → càng nhanh.
2. **Fan-out tối đa.** Mọi subtask **không phụ thuộc nhau** → dispatch **cùng một lượt, trong 1 message nhiều tool-call** (Agent tool native chạy concurrent khi gửi chung 1 block). KHÔNG dispatch tuần tự từng cái rồi chờ.
3. **Trần đồng thời = 15 subagent.** Không vượt 15 concurrent. >15 subtask độc lập → chia **wave**: 15 chạy trước, wave sau khi có slot trống.
4. **Nghi ngờ độc lập-hay-không: WRITE ≠ READ.** Subtask WRITE nghi ngờ đụng interface/file chung → coi là **PHỤ THUỘC** (gộp thành 1 mảnh hoặc serialize). Subtask READ-only nghi ngờ → coi là **độc lập** (fan-out), gộp kết quả ở orchestrator. Không bịa dependency cho READ để né fan-out; không bịa độc lập cho WRITE để ép song song.
5. **Song song vẫn theo routing + worktree isolation.** Mỗi delegate nhận worktree riêng (wrapper tự cô lập) → parallel không đụng file nhau. Persona vẫn chọn theo bảng Routing dưới.
6. **Không fan-out subtask chạm cùng file.** ≥2 subtask cùng sửa 1 file → gộp thành 1 subtask hoặc serialize (dependency thật) — tránh merge conflict giữa worktree.

**Planning gate + blackboard (BẮT BUỘC trước dispatch — kiểm được bằng mắt):** với task M trở lên, orchestrator PHẢI in bảng phân rã TRƯỚC khi gọi bất kỳ Agent nào:

| # | subtask (nhỏ nhất còn độc lập) | persona | interface locked? | phụ thuộc (# nào) | wave | verify command |
|---|---|---|---|---|---|---|

Rồi mới dispatch. Nếu bảng có ≥2 dòng cùng wave, KHÔNG được dispatch tuần tự — phải gửi chung 1 message. Bảng chỉ 1 dòng duy nhất → phải giải thích tại sao không chẻ nhỏ được (dependency chain thật hoặc task nguyên khối không tách). Với task M trở lên, bước brainstorming/plan này BẮT BUỘC làm kỹ — WRITE subtask nào cột interface-locked chưa ✅ thì KHÔNG được dispatch.

- Task **M+ multi-agent WRITE** (≥2 subtask WRITE, hoặc có subtask L/XL) → orchestrator PHẢI ghi blackboard `.claude/state/plan-<slug>.md` (cấu trúc chuẩn: xem `/resume-orchestration` mục 0) chứa: contract/interface đã lock, edge cases đã quyết, decisions log, bảng phân rã (kèm cột `agent_id` để SendMessage resume — KHÔNG có cột `status`, trạng thái sống ở `task-graph.md`), section `## Questions`. Blackboard = shared context mô phỏng: mọi subagent đọc CÙNG một nguồn sự thật thay vì mỗi prompt inline một dị bản.
- Task M đơn-agent hoặc READ-only fan-out → chỉ in bảng chat, blackboard optional (overhead ghi file > lợi ích khi không có vấn đề "các mảnh lệch nhau").
- Lifecycle: task xong (tất cả subtask done + integration verify pass) → xoá plan file cùng lúc xoá ledger. Plan file >48h không đụng → coi là stale, audit trước khi tin (ledger có TTL 48h per-entry tự prune bởi session-start.sh, plan file KHÔNG có — orchestrator tự quản).

**Enforcement:** behavioral (self-binding) — hook không đo được "chia mấy subagent" nên không hard-block; orchestrator tự tuân. Bảng phân rã in ra là bằng chứng kiểm được. Bỏ qua fan-out khi task tách được = vi phạm P0.

**Tránh:** ❌ dispatch 1 subagent ôm nguyên task lớn khi tách được. ❌ dispatch tuần tự (chờ subagent A xong mới gọi B) khi A/B độc lập. ❌ bịa dependency để làm ít việc phân rã. ❌ vượt 15 concurrent. ❌ fan-out WRITE khi interface chưa lock (các mảnh lệch nhau, merge conflict). ❌ chẻ quá ranh giới độc lập chỉ để tăng số subagent.

## Task-graph artifact (BẮT BUỘC task M trở lên)

Bảng phân rã ở Planning gate không chỉ in ra chat — với task M trở lên PHẢI ghi vào file state `.claude/state/task-graph.md` để artifact sống sót qua compact/session, ledger resume đọc được.

**Phân vai 2 artifact (dual-artifact — không trộn):** `task-graph.md` = state machine DUY NHẤT (status/tiến độ/wave/verdict) — hook parse, luôn thắng khi có mâu thuẫn về trạng thái. Blackboard `plan-<slug>.md` (xem Planning gate trên + `/resume-orchestration` mục 0) = contract/spec/edge-cases/decisions/Questions — KHÔNG giữ máy trạng thái riêng (không có field `status` của riêng nó). Lifecycle gắn chung: cả 2 file xoá cùng lúc khi graph `status: done`.

**Format (TASK-GRAPH FORMAT v1.2):**

```text
File: .claude/state/task-graph.md (runtime state, không commit vào git)
Header lines:
  # task-graph: <slug>
  status: planning|dispatched|review|integrating|done
  integration-verify: <command hoặc ->
  integration-status: pending|pass|fail
Table header đúng: | id | subtask | persona | rw | locked | deps | wave | status | verify |
Row values: id=int · rw=R|W · locked=yes|no · deps=- hoặc ids phẩy · wave=int · status=pending|dispatched|pass|revise|done · verify=command
Prompt marker (v1.2): mọi dispatch delegate-* PHẢI chứa literal `task-graph <slug>#<id>` — slug khớp đúng header `# task-graph: <slug>` của file graph hiện tại (chống graph của task khác còn sót lại / session song song đè nhầm). Marker v1 cũ `task-graph #<id>` (không slug) vẫn được tolerate — backward-compat, không hard-fail.
```

- Mỗi prompt dispatch delegate-* PHẢI chứa marker `task-graph <slug>#<id>` khớp row + slug trong file graph. Hook `pre-task-dispatch-gate.sh` HARD-BLOCK dispatch khi: graph tồn tại mà prompt thiếu marker, id không có trong bảng, slug trong marker lệch header (marker v1.2 mới), hoặc row `rw=W` có `locked≠yes` — interface-lock gate chuyển từ behavioral sang enforce cứng (khác Enforcement note ở Hard rules trên, vốn chỉ self-binding). Marker v1 (không slug) → tolerate, không block chỉ vì thiếu slug. Header bảng bị reformat (cột đổi tên/thứ tự) → gate **fail-open + WARN log** (hành vi mới — không hard-block khi parse thất bại, tránh false-block do đổi format ngoài ý).
- Orchestrator update cột `status` của row ngay sau mỗi verdict (pass/revise) từ subagent-stop-record.sh. Sau integration verify (xem đoạn Integration verify ở Generator≠verifier) → set `integration-status: pass`. Task hoàn tất → set `status: done`; `session-start.sh` dọn file khi `status: done`.
- Hook `pre-bash-gate.sh` chặn `git commit` của main-agent khi graph đang `status: integrating` mà `integration-status` chưa `pass` — chống commit tổng trước khi verify tích hợp xong.
- **Icon map v1.1** (hiển thị chat/statusline, KHÔNG ghi vào file): `⬜ pending · 🔄 dispatched · ✅ pass · ♻️ revise · ✔️ done`. File graph luôn text thuần ở cột status (hook parse text, không parse icon). Statusline script `.claude/statusline-orchestration.sh` đọc graph → render segment `📊` dưới prompt (chain sau global statusline nếu project có).

## Fable-main (P0 — chặt hơn Opus)

Khi main agent chạy **Fable**: **pure orchestrator tuyệt đối — cấm mọi code, kể cả size-S**. Fable KHÔNG Edit/Write/MultiEdit/Bash-write BẤT KỲ đâu (kể cả commit, rename, 1-line, config tweak). Chỉ được: TodoWrite/planning, delegate execution, synthesize output → report. Ngoại lệ 2 loại: (1) Write vào memory dir (`~/.claude/projects/*/memory/`, gồm MEMORY.md) — memory không phải code, không phải harness file; (2) Write vào `.claude/state/` (task-graph, ledger) — planning/state artifact, không phải code, orchestrator phải tự ghi được graph để dispatch/resume hoạt động. Mọi thứ chạm file khác (kể cả 4 case size-S dưới) → delegate hoặc STOP hỏi user.

**Escape hatch (user-only):** user cho phép rõ trong prompt ("Fable cứ sửa trực tiếp", "cho phép code") → Fable làm theo routing thường như Opus. KHÔNG tự suy diễn "task nhỏ chắc OK" — im lặng = cấm. Permission chỉ hiệu lực trong turn/task được cho phép — turn sau user im lặng = cấm lại, KHÔNG suy diễn "user đã cho phép lúc nãy".

**Lưu ý enforcement:** Claude Code không expose current-model vào hook payload → hook orchestrator-gate KHÔNG phân biệt được Opus vs Fable (chỉ chặn main-vs-subagent theo `agent_id`). Ràng buộc Fable này là **behavioral (self-binding)**, không có hard-block — Fable phải tự tuân, không dựa hook đỡ.

**Chi phí — KHÔNG phải constraint.** Token/cost không phải yếu tố quyết định routing; mục tiêu duy nhất = nhanh + chất lượng. Sonnet = executor chính cho code thật, fan-out thoải mái trong trần 15. Gemini/DeepSeek/Codex = phụ trợ (chi tiết ở ghi chú sau bảng Routing dưới), không dùng thay Sonnet chỉ vì rẻ hơn.

## Size-S — Opus làm trực tiếp (4 case)

1. TodoWrite / planning
2. 1-line edit + 0 read context (commit, push, rename, config tweak) — >1 dòng diff HOẶC phải đọc file trước → hết là S, route theo bảng dưới
3. Read < 50 dòng, single file
4. Synthesize delegate output → user report

## Routing (size + loại → delegate + fallback chain)

| Nhãn | Loại | Giao cho | Fallback (theo thứ tự, không quay vòng) |
|---|---|---|---|
| **S** | 4 case trên | **Opus main** | — |
| **reasoning-only** | architecture design, debug chẩn đoán root cause, code review (KHÔNG kèm edit) | **Opus main** | — |
| **M-mechanical** | boilerplate / batch edit | `delegate-deepseek` | → sonnet → re-classify L/XL (1 lần) → STOP + báo user |
| **read-only** | audit, cross-file summary, grep rộng, risk analysis | `delegate-gemini` | → deepseek → sonnet (khi 2 wrapper vắng/fail) → STOP + báo user |
| **hard-reasoning-code** | bug khó đã resist fix thường, algo design phức tạp, security-sensitive edit, refactor invariant tinh vi (concurrency, transaction) | `delegate-codex` | → sonnet → STOP: Opus re-decompose spec |
| **L/XL** | code/edit thật theo spec rõ: implement feature, refactor thường, fix bug sau khi đã chẩn đoán rõ nguyên nhân | `delegate-sonnet` | → codex → STOP: Opus re-decompose spec (KHÔNG rơi về DeepSeek) |

Routing table giữ nguyên nhãn, nhưng vai trò: `delegate-sonnet` = executor mặc định cho code thật (L/XL); DeepSeek/Gemini/Codex là phụ trợ theo mô tả ở đoạn Chi phí — không dùng thay Sonnet chỉ vì "rẻ hơn".

### Code-level enforcement (không chỉ dựa Opus tự nhớ bảng trên)

Ranh giới "execution vào core → MUST delegate" nay có hook chặn cứng (exit 2), phủ **mọi write surface** để Opus không né được bằng tool khác:

| Hook | Matcher | Chặn gì |
|---|---|---|
| `pre-edit-orchestrator-gate.sh` | `Edit\|Write\|MultiEdit\|NotebookEdit` | Main-agent (Opus) Edit/Write/MultiEdit vào core (dir bake install-time từ `HARNESS_CORE_DIRS`). Subagent → allow. + risk-path denylist cho persona `delegate-gemini`/`delegate-deepseek` (chặn dù trong subagent). |
| `pre-bash-gate.sh` | `Bash` | Main-agent Bash-write core (gộp orchestrator + git-push + merge-verdict gates) (`sed -i`, `>`, `tee`, `patch`, `git apply`, `python -c`...) + gọi thẳng `aider`/`gemini`/`codex` (bypass wrapper). |

- **Discriminator** main vs subagent: field `agent_id` (chỉ có ở subagent). Subagent execute core → allow (đó là việc của nó).
- **Escape hatch** size-S 1-line thật (Edit + Bash-write): `ORCHESTRATOR_GATE_BYPASS=1` → allow + audit log. KHÔNG áp cho direct-CLI và risk-path (security boundary, không phải convenience).
- **Threat model**: chống Opus lười/nhầm vô ý, KHÔNG chống adversary (command-string heuristic, chuỗi obfuscate lách được — nhưng Opus không phải kẻ tấn công).
- **Risk-path** (auth/payment/wallet/...): project khai báo `env.HARNESS_RISK_DIRS` trong `.claude/settings.json` — đọc runtime, sửa 1 dòng JSON hiệu lực ngay, không re-run installer. Opus vẫn phải chọn đúng persona (Codex/Sonnet) ngay từ đầu cho domain nhạy cảm — hook chỉ là lưới cuối, bị chặn giữa chừng vẫn tốn 1 vòng gọi.

Hook = enforcement chính của ranh giới size-S, KHÔNG chỉ advisory. Fail-open khi thiếu jq / payload không JSON (nhất quán mọi gate). Off-switch: `HARNESS_DELEGATE=0`.

Nguyên tắc L/XL vs hard-reasoning-code: task cần suy luận sâu (bug khó, algo, security, invariant tinh vi) → route thẳng **Codex trước**, không qua Sonnet. Task L/XL thường (spec rõ, implement/refactor bình thường) → **Sonnet trước**, Codex chỉ fallback khi Sonnet không xử lý được. Cả hai đều **không phải Opus tự ôm**. M-mechanical ưu tiên DeepSeek trước (offload việc cơ học thuần khỏi luồng chính — sai cũng dễ reject), fallback Sonnet ngay khi DeepSeek fail.

**Heuristic M vs L/XL** (ranh giới routing quan trọng nhất): chạm ≤3 file + pattern lặp lại + KHÔNG đổi logic/behavior (rename, đổi signature hàng loạt, format, boilerplate) → **M-mechanical**. Đổi behavior, thêm/sửa algo, refactor đụng invariant, fix bug cần suy luận → **L/XL**. Nghi ngờ giữa 2 nhãn → chọn nhãn cao hơn (L/XL) vì under-provision subagent tốn 1 vòng fallback.

**Heuristic L/XL vs hard-reasoning-code**: tín hiệu "đã thử fix không được", "security review", "concurrency/race condition", "thiết kế thuật toán phức tạp" → **hard-reasoning-code** (Codex trước). Spec rõ, biết ngay cách làm (thêm field, implement theo design có sẵn, refactor cơ học có suy luận nhẹ) → **L/XL** (Sonnet trước). Nghi ngờ → chọn hard-reasoning-code (Codex mạnh hơn, an toàn hơn khi under-provision).

**Repo KHÔNG có delegate wrapper** (`scripts/delegate/` vắng): chỉ `delegate-sonnet` (in-harness) chạy được — mọi nhánh cần execute route thẳng sang in-harness subagent (Sonnet), KHÔNG STOP, KHÔNG Opus tự ôm. Ghi rõ trong report là repo thiếu wrapper.

## Reasoning vs execution (ranh giới thật, không phải "khó vs dễ")

- **Opus tự làm reasoning:** thiết kế architecture (đưa approach, không viết code triển khai), chẩn đoán debug (tìm root cause, không tự sửa), review diff/PR (đưa findings, không tự apply fix).
- Diff > ~500 dòng: `delegate-gemini` first-pass summary + hotspot list trước, Opus review trên summary (tránh nuốt diff dài vào context).
- Reasoning xong cần code/edit thật → giao delegate (L/XL), kết quả reasoning làm spec đầu vào cho sub-task prompt.
- Opus KHÔNG tự viết/sửa code L/XL dù đã tự chẩn đoán root cause — chẩn đoán và implement là 2 bước tách biệt.

## Generator ≠ verifier (review split)

Khi task đủ lớn/nhạy cảm để cần review sau execute: **subagent implement KHÔNG được là subagent review**. Người viết code có bias xác nhận diff của chính mình đúng → verify phải do persona khác chạy, đọc diff như code lạ.

- **L/XL + security-sensitive / cross-module / >~300 dòng diff**: sau khi implementer (Sonnet/Codex) xong, dispatch **1 review pass riêng** — Opus tự review (reasoning-only) HOẶC delegate persona khác implementer. Không tái dùng chính worktree/agent đã sinh diff để tự chấm.
- Review pass **read-only**: đưa findings, KHÔNG tự apply fix. Fix = vòng execute mới (route lại theo bảng).
- Task S/M thường: Opus review trực tiếp là đủ, không cần split riêng.

**Integration verify (BẮT BUỘC sau merge nhiều worktree):** mỗi mảnh verify pass riêng ≠ ghép lại chạy đúng. Sau khi merge ≥2 worktree của cùng 1 task về branch làm việc, orchestrator PHẢI chạy verify tích hợp (test suite / build / smoke command của project) trên branch đã ghép TRƯỚC khi coi task xong hoặc commit tổng. Integration verify fail → xử lý như REVISE: chẩn đoán mảnh nào lệch, vòng execute mới — KHÔNG merge đè tiếp.

**Reasoning-effort knob (Codex):** task càng khó → bơm effort qua `-c model_reasoning_effort="high|xhigh"` trong sub-task prompt (không phải default mới — default giữ ở wrapper). Smoke/lint/verify nhẹ → `low`. Chỉ là knob per-call, không tạo persona mới.

## Loop guard (hard rules)

- Mỗi task tối đa **2 lần fallback**; hết chain → STOP + báo user, KHÔNG quay lại model đã fail.
- Cả 2 model đầu chain L/XL fail → mặc định lỗi nằm ở **spec/prompt** → re-decompose trước khi retry.
- Re-classify (M → L/XL) chỉ được **1 lần** per task.
- Resume-fix xong PHẢI có review pass mới ra `VERDICT: APPROVE` trước khi merge — `pre-bash-gate.sh` chặn `git merge` khi verdict gần nhất còn REVISE.

### Revise = SendMessage, không spawn mới

Vòng REVISE cho cùng subtask → `SendMessage` tới ĐÚNG subagent đã implement (theo tên hoặc `agent_id`) — nó giữ nguyên context diff của nó, không tốn vòng đọc lại repo. CHỈ spawn agent mới khi: (a) đổi persona theo fallback chain (vd Sonnet fail → Codex), hoặc (b) review pass (generator ≠ verifier — xem section dưới, review PHẢI là agent khác implementer). Agent name resolve theo latest-wins; trùng tên → dùng `agent_id` raw để chắc đúng agent. Ledger sẽ có NHIỀU dòng `subagent done` cùng `agent_id` (mỗi lần resume-stop 1 dòng) — đó là iterations, không phải duplicate.

## Sub-task prompt (orchestrator → delegate) — self-contained

Delegate KHÔNG có session context. Mỗi prompt PHẢI đủ: (1) repo path + branch absolute, (2) spec đầy đủ (interface/contract đã lock + edge cases đã quyết — KHÔNG để delegate tự đoán quyết định thiết kế), (3) file paths, (4) acceptance criteria, (5) verify command, (6) NO commit — produce diff only, (7) worktree isolation cho edit task, (8) return summary <300 words, (9) timeout mặc định 10 phút (wrapper kill quá hạn = FAIL → sang fallback).

**Pointer-prompt (khi có blackboard):** prompt trỏ absolute path plan file (`/Users/.../.claude/state/plan-<slug>.md`) để delegate đọc contract/edge-cases đầy đủ, NHƯNG vẫn PHẢI inline tối thiểu: repo path absolute, scope file paths, verify command, "NO commit — diff only", acceptance 1-2 dòng — vì `pre-task-dispatch-gate.sh` grep 4 marker (path `/Users/`|`repo`, `verify|test`, `file|path|scope`, `commit`) + ≥200 chars; prompt chỉ có mỗi pointer trần sẽ bị chặn. Subagent gặp mâu thuẫn spec ↔ code thực tế → ghi vào section `## Questions` của plan file + STOP báo lại, KHÔNG tự đoán quyết định thiết kế. Orchestrator trả lời (update plan file) → resume agent đó qua SendMessage.

## Dispatch visibility (chống chờ câm)

1. **Banner trước dispatch (BẮT BUỘC mọi lần gọi Agent/wrapper):** trước mỗi tool-call dispatch, orchestrator in 1 dòng cho user: persona + task slug + timeout dự kiến + (nếu là wrapper delegate) đường dẫn log. Ví dụ: `⏳ Dispatching delegate-codex — task fix-auth-race, timeout 600s, log: .claude/state/delegate-runs/codex-fix-auth-race-<epoch>.log`. Fan-out nhiều agent → 1 dòng mỗi agent hoặc bảng ngắn.

2. **Wrapper delegate (deepseek/gemini/codex) — live progress qua Monitor:** wrapper đã tee output + heartbeat 30s vào `.claude/state/delegate-runs/<agent>-<feat>-<epoch>.log`. Pattern chuẩn: chạy wrapper qua `Bash run_in_background` (không block); arm `Monitor` tail log đó với `tail -f <log> | grep -E --line-buffered "⏳ running|STATUS=|FAIL|ERROR"` (log path lấy từ dòng `▶ live log:` wrapper in ra lúc start, hoặc glob file mới nhất trong `.claude/state/delegate-runs/`); xong việc → TaskStop monitor nếu còn sống.

3. **In-harness subagent (delegate-sonnet, Agent tool):** harness KHÔNG expose tiến độ giữa chừng — không có log để tail. Bù bằng: banner lúc dispatch (mục 1) + báo user ước lượng thời gian + khi subagent return thì tóm kết quả ngay. KHÔNG bịa progress giả.

4. **Tránh:** ❌ dispatch câm không banner. ❌ foreground Bash chạy wrapper 10 phút (user nhìn spinner trống — luôn `run_in_background` + Monitor với wrapper). ❌ Monitor filter quá rộng (raw log spam chat) — chỉ heartbeat + terminal signals.

5. **Progress table:** sau mỗi verdict cập nhật row trong task-graph, in lại bảng graph ra chat với icon map v1.1 (hoặc dòng đếm tóm tắt `✅n 🔄n ♻️n ⬜n` khi bảng lớn) — user thấy tiến độ không cần hỏi.

## Hard constraints

- KHÔNG gọi trực tiếp `aider`/`gemini`/`codex` CLI từ shell để bypass delegate wrapper (xem [[delegate-llm]]).
- KHÔNG để delegate auto-commit; Opus review diff trước, commit sau.
- KHÔNG merge delegate worktree nếu diff chạm ngoài scope.
- Fallback theo đúng chain khai báo ở trên, KHÔNG nhảy cóc — Sonnet là executor chính cho code thật (L/XL) nhưng các nhãn khác (M-mechanical, read-only, hard-reasoning-code) vẫn đi persona primary của nhãn đó trước.

Context window per-conversation (~200K auto-compact tự chạy): xem [[token-budget]] — orchestrator luôn bật, không liên quan on/off.

> **Project-specific:** delegate wrapper path (`scripts/delegate/`), persona (`.claude/agents/delegate-*`) khai báo trong repo. Xem `.claude/rules/orchestrator-<project>.md` nếu có.

## Hooks bổ trợ orchestration

| Hook | Event | Vai trò |
|---|---|---|
| `pre-task-dispatch-gate.sh` | PreToolUse (Task) | Chặn dispatch subagent khi prompt under-specified (thiếu spec/path/verify) |
| `pre-bash-gate.sh` | PreToolUse (Bash) | Chặn `git merge` khi verdict code-reviewer gần nhất là REVISE |
| `post-bash-stuck-detector.sh` | PostToolUse (Bash) | Cảnh báo khi lặp cùng lệnh ≥4 lần (thrashing) |
| `subagent-stop-record.sh` | SubagentStop | Ghi verdict (PASS/REVISE) + trạng thái subagent vào ledger để resume sau; nay ghi thêm `verdict=` vào ledger + append metrics JSONL; nhiều dòng cùng `agent_id` = resume iterations (SendMessage) |
| `session-start.sh` | SessionStart | Đọc ledger, hiển thị task dở dang qua `/resume-orchestration` |

Bảng trên chỉ liệt hooks orchestration; không phải full hook inventory (repo có ~8 hooks harness chính — số còn lại thuộc secret/host/syntax/memory/session guard).

**Vai ledger (`orchestrator-ledger.md`):** audit-trail PHỤ, append-only, TTL 48h tự prune (`session-start.sh`) — KHÔNG phải state machine. `task-graph.md` là nguồn TRẠNG THÁI chính; ledger chỉ dùng để đối chiếu completion khi resume (khớp `agent_id` xem subtask nào đã có "subagent done"), không phải nguồn resume chính. Graph đã xoá (`status: done`) mà ledger còn sót dòng cũ → bình thường, không phải bug.

**Metrics JSONL:** `subagent-stop-record.sh` append mỗi verdict vào `~/.cache/claude-code-<slug>/orchestration.jsonl` (fields: `ts`, `agent_id`, `type`, `verdict`) — dữ liệu cho audit định kỳ (đếm revise-rate, fallback-rate để chỉnh spec template).
