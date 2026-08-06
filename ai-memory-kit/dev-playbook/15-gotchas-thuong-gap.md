# 15 — Cạm bẫy hay gặp (server-action · overlay Portal · Supabase rò RAM)

🎯 **Vấn đề:** 3 lỗi rất hay dính, mất nửa ngày dò mỗi lần, fix 1 lần là xài mãi.

## A. Next.js server action: TRẢ `{ok,error}`, đừng throw
Production Next.js **che mọi `throw`** trong server action thành câu generic ("Server Components render…") + `digest` → người dùng không thấy lỗi thật. → Lỗi nghiệp vụ phải TRẢ VỀ giá trị, không throw.
```ts
export type ActionResult<T=undefined> =
  | { ok: true; data?: T; warning?: string|null }
  | { ok: false; error: string };

export async function createRecord(input: FormData): Promise<ActionResult> {
  try { /* ... */ return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Có lỗi xảy ra' }; }
}
// client: const r = await createRecord(fd); if (!r.ok) toast.error(r.error);
```
- `throw` chỉ cho lỗi hệ thống bất ngờ thật. Lấy lỗi thật từ **server log** (`⨯ Error:` + `digest`).
- 💡 **Idempotent khi tạo 2 resource không cùng transaction** (vd auth user + profile): lỗi giữa chừng để lại bản ghi mồ côi → thao tác idempotent: nếu user đã tồn tại mà chưa có profile → **nhận lại** thay vì báo "đã tồn tại". (Xem `snippets/server-action-result.ts`.)

## B. Overlay/modal `fixed` bị "nhốt" → render qua Portal
`position:fixed` tính toạ độ theo ancestor gần nhất có `transform`/`filter`/`backdrop-filter`/`perspective`/`will-change` (vd header mờ) — KHÔNG theo viewport → overlay chỉ phủ 1 dải. Sửa: render qua `createPortal` ra `document.body`.
```tsx
import { createPortal } from "react-dom";
function Modal({ open, children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);             // tránh đụng document khi SSR
  return open && mounted
    ? createPortal(<div className="fixed inset-0 z-50 bg-black/50">{children}</div>, document.body)
    : null;
}
```
**Bắt nhanh:** overlay chỉ hiện trong vùng 1 ancestor (không full màn) → gần như chắc dính. (Xem `snippets/modal-portal.tsx`.)

## C. Supabase client rò RAM → singleton + tắt autoRefreshToken phía server
Mỗi `createClient()` với `autoRefreshToken` (mặc định BẬT) để lại ~11KB RAM không thu hồi trên server → traffic cao + chạy lâu = phình tới GB.
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, anon, { auth: { persistSession:false, autoRefreshToken:false } });
let _admin: SupabaseClient|null = null;             // SINGLETON, chỉ server
export function supabaseAdmin() {
  return _admin ??= createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession:false, autoRefreshToken:false } });
}
```
3 quy tắc: ① server-side MỌI client `autoRefreshToken:false` (service key không hết hạn) · ② singleton cho admin client · ③ client per-user vẫn `autoRefreshToken:false`. **Ngoại lệ giữ `true`:** browser client đăng nhập thật (1 tab = 1 client, không leak); `@supabase/ssr` đã tự tắt sẵn. Bẫy TS: dùng `type SupabaseClient` import, đừng `ReturnType<typeof createClient>` (mất generic → `never` → vỡ build). (Xem `snippets/supabase-client.ts`.)

> **Nguyên tắc gốc (không riêng Supabase):** tài nguyên nặng (DB pool, HTTP client, SDK) = khởi tạo 1 lần (singleton), KHÔNG `new` mỗi request. Nghi rò RAM → viết test ĐO thật rồi mới chốt root-cause.

## 📋 Checklist
- [ ] Server action trả `{ok,error}`, không throw lỗi nghiệp vụ
- [ ] Overlay/modal render qua Portal ra body
- [ ] Client Supabase server: singleton + `autoRefreshToken:false`

> Rửa: tên dự án, số liệu leak cụ thể, tên DB/ref.

---

## Bổ sung — cạm bẫy dữ liệu · điều hướng · boot · dependency

### Driver Postgres trả `bigint`/`numeric` về CHUỖI → cộng tổng tiền bị NỐI CHUỖI
**Triệu chứng:** bảng tổng tiền hiện con số vô lý khổng lồ (kiểu ×10²⁷) dù chỉ vài đơn; đồng thời cột tiền của từng dòng hiện "—". Dấu vết nhận diện rất nhanh: cột ép `::int` (vd đếm số đơn) hiển thị ĐÚNG, chỉ cột ép `::bigint`/`::numeric` sai → so 2 cột là ra ngay. KHÔNG phải data rác, không phải mất tiền.
**Nguyên nhân:** driver Postgres trả cột kiểu `bigint`/`numeric` (kể cả `count(*)::bigint`, `sum(...)::bigint`) về **string**, không phải number (để tránh mất chính xác > 2⁵³). Dù TypeScript khai `x: number`, lúc chạy là `"123"`. → FE `reduce((s,r)=>s + r.x, 0)`: `0 + "123" + "456"` **NỐI CHUỖI** thành số rác. → Formatter kiểu `typeof n === "number" ? fmt(n) : "—"` ra **"—"** vì giá trị là chuỗi.
**Cách vá (2 lớp, đúng SSOT):**
- **Backend = nguồn, vá ở đây:** map ép `Number()` đúng cột `bigint`/`numeric` trước khi trả (vd trong hàm normalize-row). Khớp pattern các query anh-em cùng repo đã `Number(r.x)`.
- **FE = chắn tiền (phòng thủ):** `s + Number(r.x ?? 0)` ở mọi `reduce` cộng tiền + `fmt(Number(r.x ?? 0))` ở cột — không bao giờ tin kiểu qua mạng cho vùng TIỀN.
- ⚠️ **KHÔNG** đặt global `pg.types.setTypeParser(20, Number)` — ID kiểu `bigint > 2⁵³` sẽ mất chính xác. Ép theo từng cột.
- An toàn miền giá trị: số tiền trong `Number` an toàn tới ~9×10¹⁵ (quá đủ). Khi dựng màn tổng tiền mới → soát cột nào `::bigint`/`::numeric` + ép `Number` ngay.

### `searchParams` cho UI CỤC BỘ làm Server Component refetch CẢ trang mỗi lần bấm
**Triệu chứng:** bấm tab/filter "có cái nhanh có cái chậm", lag khó hiểu — URL đã mở trước thì nhanh, URL mới thì chậm.
**Nguyên nhân:** trang là **Server Component động** (đọc cookies/auth → uncached). UI cục bộ (tab, filter trong trang) đổi `?tab=`/`?q=` bằng `router.replace()`/`router.push()` → framework coi là **điều hướng** → **chạy lại CẢ Server Component + refetch MỌI query của trang** mỗi lần bấm. "Nhanh/chậm" = do router-cache: URL đã cache → hit (nhanh); URL mới → fetch lại (chậm). Càng nhiều query trong page càng lộ.
**Cách vá (UI cục bộ, không cần data mới từ server):** giữ state ở client, khởi tạo **1 lần** từ `searchParams` (để deep-link/refresh vẫn đúng), cập URL bằng **History API** (`window.history.replaceState`) chứ đừng navigate.
```ts
// activeKey GIỮ Ở STATE, khởi tạo 1 lần từ ?tab= (deep-link/refresh)
const [activeKey, setActiveKey] = useState(() => initFromSearchParams());
function setTab(key) {
  setActiveKey(key);                 // đổi UI tức thì (client)
  const p = new URLSearchParams(window.location.search);
  p.set("tab", key);
  window.history.replaceState(null, "", `${location.pathname}?${p}`); // cập URL, KHÔNG navigate
}
```
→ Đổi tab **tức thì**, **vẫn giữ deep-link**. Framework hiện đại hỗ trợ chính thức `history.pushState/replaceState` để sync URL không re-render; hook đọc searchParams chỉ cần lúc init. **Vẫn dùng `router.replace`** khi đổi param THẬT SỰ cần data mới từ server (đổi trang/khoảng lọc mà server phải truy vấn lại).

### App CI XANH + unit test XANH nhưng KHÔNG BOOT (lỗi DI container)
**Triệu chứng:** CI 5/5 xanh + toàn bộ unit test xanh, nhưng app **crash ngay khi boot** (dev/deploy). Lỗi kiểu `UnknownDependencies` — 1 module không resolve được provider mà 1 guard/interceptor dùng-chung-toàn-app phụ thuộc.
**Nguyên nhân:** guard/interceptor dùng-chung được **nhiều module tự khai trong `providers:`** (để dùng decorator gắn guard). Khi guard nằm trong providers của module X, container dựng instance RIÊNG trong injector của X → **mọi dependency của guard phải resolve được TRONG X**. Nếu provider mới chỉ được provide lẻ ở 1 feature-module → các module khác không thấy → nổ lúc dựng cây DI. Test per-module MÙ lỗi cross-module này.
**Cách vá:**
- Provider mà 1 guard **dùng-chung-toàn-app** phụ thuộc → phải khai **@Global**: tách ra một module riêng `@Global()` + `exports`, import **1 lần** ở module gốc (giống cách DB pool được `@Global` nên resolve khắp nơi). Một instance duy nhất → provider có trạng thái (cache) thì flush/mutate vẫn đúng across mọi module. ĐỪNG provide lẻ ở 1 feature-module.
- **LUÔN có 1 test BOOT cả app-module gốc:** dựng testing-module import cả app-module, override DB pool bằng fake (`{query:async()=>({rows:[],rowCount:0}), connect:async()=>({release(){}})}`) → không cần DB thật, chỉ kiểm **cây DI dựng được mọi provider**.
- **CI xanh ≠ app BOOTS.** Sau deploy BẮT BUỘC verify boot thật: `health` trả 200 + 1 route auth-gated trả **401** (route sống + boot xong). Đừng tin "merge CI xanh → chạy".

### `grep` TEXT schema để dò cột (vd `deleted_at`) hay SAI
**Triệu chứng:** grep tên cột trong file schema thấy "không có" → kết luận nhầm là bảng thiếu cột đó, xử lý sai theo.
**Nguyên nhân:** nhiều bảng dựng bằng **hàm spread dùng chung** (kiểu `...base()`) nên tên cột chung (id, timestamps, `deleted_at`…) **không lộ ra dưới dạng chữ** trong file định nghĩa bảng → grep text sót.
**Cách vá:** dò cột **LÚC CHẠY** qua `information_schema.columns` (query hoặc introspect), đừng grep chữ trong file. Tin nguồn sự thật là schema thực trong DB.

### Sửa dep vendored (dạng `file:`) qua pnpm KHÔNG thấy đổi
**Triệu chứng:** sửa file nguồn của một gói **vendored** (dep khai dạng `file:...` trong repo) xong, `tsc`/build **vẫn báo prop/hàm cũ không tồn tại** dù entry trỏ thẳng vào source.
**Nguyên nhân:** pnpm **COPY** `file:` dep vào store ảo lúc install → bản trong `node_modules/<gói>` **STALE**, không phản ánh sửa mới trong source.
**Cách vá:**
- **Re-sync store:** chạy `pnpm install --offline` (chỉ copy lại `file:` dep, rất nhanh, không cần mạng). Kiểm: `grep -c "<prop-mới>" node_modules/<gói>/src/<file>` ra > 0.
- **KHÔNG commit lockfile bị prune:** `--offline` thường **PRUNE lockfile** (xóa cả nghìn dòng dep optional/network nó không verify được offline) → `git restore <lockfile>` trước khi commit. `file:` dep không mã hóa nội dung vào lockfile (chỉ pin resolution) nên restore an toàn.
- Yên tâm deploy: CI chạy `pnpm install` SẠCH → re-copy `file:` dep từ source hiện tại; chỉ **store LOCAL** stale, không cần publish/bump version.

### Thêm quyền/menu mới làm VỠ test đếm (snapshot)
**Triệu chứng:** vừa thêm 1 quyền (permission) hoặc 1 mục menu thì test snapshot/đếm số quyền/số mục menu **đỏ**, dù logic đúng.
**Nguyên nhân:** có test chốt cứng **số lượng** quyền/mục menu (snapshot hoặc `expect(list.length).toBe(N)`); thêm phần tử làm lệch con số.
**Cách vá:** khi thêm quyền/mục menu, **cập test đếm cùng lúc** (cùng commit) — coi đây là bước bắt buộc của việc thêm quyền/menu, đừng để CI đỏ rồi mới nhớ.

### Cờ "dưới ngưỡng"/thiếu-data mặc-định-0 báo cảnh báo RÁC
**Triệu chứng:** rule cảnh báo kiểu "giá vốn = 0", "số lượng < mức tối thiểu" nổ cả loạt cho những bản-ghi **chưa từng nhập liệu**, gây nhiễu, người dùng mất tin vào cảnh báo.
**Nguyên nhân:** trường chưa nhập mang **mặc định 0/null**, mà rule so sánh ngưỡng lại bắt luôn giá trị mặc-định-chưa-nhập như thể là dữ liệu thật.
**Cách vá:** **loại các bản-ghi mặc-định-chưa-nhập** (0/null vì chưa có ai điền) TRƯỚC khi chạy rule cảnh báo — chỉ cảnh báo trên bản-ghi đã thực sự có dữ liệu. Phân biệt rõ "0 vì chưa nhập" với "0 vì đúng là 0".

### Thêm dep (kể cả optional) mà quên regen lockfile → CI `--frozen-lockfile` FAIL nhanh, local vẫn xanh
**Triệu chứng:** CI ở bước cài dependency **fail rất nhanh** (chục giây) với lỗi kiểu "lockfile is not up to date with package.json" / `ERR_..._OUTDATED_LOCKFILE`. Test LOCAL vẫn xanh bình thường → dễ tưởng CI bị lỗi vặt, đi tra sai hướng.
**Nguyên nhân:** thêm 1 dependency vào `package.json` — **kể cả khi để trong `optionalDependencies`** (vd một gói chỉ cần lúc chạy local) — mà không chạy lại install để cập nhật lockfile. Local xanh vì `node_modules` đã có sẵn gói (cài tay lúc dev) nên trình test không cần lockfile khớp. CI thì luôn cài **sạch** với cờ frozen-lockfile (`pnpm install --frozen-lockfile` / `npm ci`) — thấy `package.json` và lockfile lệch nhau là chặn ngay, không tự cập nhật giùm.
**Cách vá:**
1. Regen lockfile: `pnpm install --lockfile-only` (pnpm) hoặc `npm install --package-lock-only` (npm) — chỉ cập lockfile, không cần tải lại toàn bộ `node_modules`.
2. Kiểm diff lockfile là hợp lý (không xoá/đổi lung tung phần không liên quan) rồi commit **cùng lúc** với `package.json`.
3. Thói quen phòng tránh: mọi lần sửa `package.json` → chạy lại install + commit lockfile trong CÙNG commit; trước khi push liếc `git status` xem lockfile có nằm trong danh sách thay đổi chưa.

> Khác với lỗi lockfile không khớp lúc **build/deploy** vì node version sai (xem bài 01) — đây là gate **cài dependency ở bước CI**, xảy ra ngay cả khi node version đã đúng.

### Alias import (`@/...`) chạy được ở build nhưng vỡ khi test-runner import trực tiếp
**Triệu chứng:** file dùng alias kiểu `@/lib/...` build/biên dịch bình thường (framework, `tsc`), nhưng khi bị 1 file test **import trực tiếp** thì test-runner báo `Cannot find module '@/lib/...'`. CI có thể vẫn xanh nếu suite test đó chưa từng đụng layer bị vỡ.
**Nguyên nhân:** mỗi công cụ (bundler, `tsc`, test-runner, runtime) có **bộ module-resolver RIÊNG**. Alias `@/` thường chỉ được `tsconfig.json` paths + bundler/framework hiểu; test-runner (Vitest/Jest…) **không tự đọc tsconfig paths** trừ khi được cấu hình, nên không biết `@/` trỏ về đâu.
**Cách vá (2 lựa chọn):**
1. Đổi sang import **tương đối** (`../lib/...`) ở file bị test import trực tiếp — đơn giản, 0 cấu hình thêm.
2. Hoặc cấu hình alias cho test-runner: thêm `resolve.alias` trong config test (vd `vitest.config.ts`) hoặc dùng plugin đọc tsconfig paths (`vite-tsconfig-paths`…) để test-runner map `@/` giống bundler.

**Quy tắc chung:** sau khi đổi cách import, phải chạy thử **đúng tầng bị ảnh hưởng** (test/worker/script gọi trực tiếp) — đừng chỉ tin `tsc`/build xanh là đủ, vì mỗi tầng resolve module khác nhau.

### Vá "fail-closed" (bỏ default-credential/seed yếu) trên app CÓ TRẠNG THÁI LƯU chỉ chặn cái MỚI
**Triệu chứng:** merge 1 patch kiểu "thiếu biến môi trường thì từ chối seed tài khoản mặc định" (fail-closed), deploy xong app chạy bình thường → tưởng đã vá xong lỗ hổng credential mặc định.
**Nguyên nhân:** nếu app giữ trạng thái đã ghi (file/DB trên volume, vd `users.json`), lúc khởi động lại thấy dữ liệu **đã tồn tại từ trước** nên bỏ qua hẳn bước seed (không throw, không đụng tới biến môi trường mới) → patch chỉ chặn được **lần seed MỚI (từ đầu, chưa có dữ liệu)**. Tài khoản/credential **gieo TỪ TRƯỚC** (thời còn dùng giá trị mặc định yếu) vẫn còn nguyên trong dữ liệu đã lưu → sau merge + deploy, credential yếu đó **vẫn đang sống**.
**Cách vá:** merge code chỉ lo phần **tương lai** (deploy sạch từ đầu sẽ an toàn). Muốn xử triệt để bản **đang chạy** phải **verify + chủ động đổi/rotate credential đang sống** — qua UI quản trị trong app (an toàn nhất, không cần đụng secret trực tiếp) hoặc xoá state cũ trên volume rồi set lại biến môi trường mạnh. Đừng coi "merge xong + deploy OK" = "đã an toàn" khi app có state persist.

### "Chưa deploy ở đâu" đừng kết luận bằng grep TÊN-REPO
**Triệu chứng:** grep danh sách service trên nền tảng hạ tầng (PaaS) theo đúng tên repo → không thấy → kết luận "repo này chưa deploy ở đâu cả". Kết luận này có thể SAI.
**Nguyên nhân:** tên **service/project** trên PaaS thường **KHÁC** tên repo (đặt lại tên lúc setup, gộp nhiều service vào 1 project chung…) — grep đúng-chữ theo tên repo dễ bỏ sót service đang chạy thật.
**Cách vá:** muốn biết 1 repo có đang chạy ở đâu không → liệt kê **HẾT** service/project trên nền tảng rồi đối chiếu theo **domain thực tế** đã biết của app (không phải theo tên), hoặc hỏi trực tiếp người phụ trách "app đó chạy ở domain nào" — đừng tin 1 lần grep theo tên đoán là đủ.

### main-guard ESM sai khi path có dấu-cách/`~` — so `file://` thô bị lệch %-encode
**Triệu chứng:** script Node ESM có kiểu "chạy trực tiếp thì làm việc X" (`if (import.meta.url === \`file://${process.argv[1]}\`)`) — chạy thẳng `node script.mjs` nhưng **không thấy làm gì** (no-op im lặng, không báo lỗi).
**Nguyên nhân:** khi đường dẫn file chứa **dấu cách** hoặc dấu `~` (thư mục home viết tắt, tên thư mục có khoảng trắng…), `import.meta.url` bị runtime mã hoá phần trăm (`%20`, `%7E`…) còn `process.argv[1]` giữ nguyên chuỗi thô → so sánh chuỗi 2 vế **lệch nhau dù cùng 1 file**, guard luôn `false`.
**Cách vá:** đừng so chuỗi `file://` thô — chuẩn hoá cả 2 vế về đường dẫn thật rồi so, vd `realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])`. Script nào trong repo còn dùng main-guard kiểu so chuỗi `file://` trực tiếp đều nên rà lại nếu có thể chạy trong môi trường path chứa dấu cách/`~`.
