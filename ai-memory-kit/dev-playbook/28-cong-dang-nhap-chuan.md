# 28 — Cổng đăng nhập chuẩn (middleware gác cổng · màn login · xác minh JWT)

🎯 **Vấn đề:** app có khu vực "phải đăng nhập mới vào" (admin nội bộ, dashboard khách hàng, SaaS B2B) dựng trên Next.js App Router — nếu chỉ khoá DỮ LIỆU (mỗi trang tự kiểm quyền) mà quên khoá KHUNG, người chưa đăng nhập vẫn thấy nguyên sidebar + tên/đếm dữ liệu dù số liệu đã ẩn. Thêm nữa: xác minh JWT chọn sai cách theo thuật toán ký sẽ tự đá người dùng ra ngay khi hạ tầng xoay khoá ký, trông y hệt "sai mật khẩu".

Bài này giải quyết gì: khuôn 3 lớp gác-cổng tái dùng cho mọi app "có-cổng" (mục A), cách CHỌN cách xác minh JWT theo cấu hình ký (mục B), và luật auth-guard "redirect chứ không throw" chống lỗi 500 ẩn ở trang production (mục C).

---

## A. 3 lớp gác cổng (đủ thì kín)

### 1. Middleware GÁC CỔNG (`middleware.ts` ở gốc repo)
Chưa có cookie phiên → redirect `/login`. Bài học cốt lõi: **chặn DỮ LIỆU (guard/RLS từng trang) ≠ chặn KHUNG** (menu, tên, số đếm). Thiếu lớp này thì người chưa đăng nhập vẫn thấy đủ khung app.

```ts
// middleware.ts — chạy Edge, KHÔNG import module kéo theo crypto/DB
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'app_session';       // đổi theo tên cookie thật — khớp lib/session.ts
const SSO_COOKIE = 'sso_session';           // cookie phụ nếu có SSO/ứng dụng thứ 2 cùng đăng nhập
const PUBLIC_PREFIXES = ['/login', '/api', '/_next', '/favicon.ico'];
const STATIC_EXT = /\.(png|jpg|jpeg|svg|css|js|ico)$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || STATIC_EXT.test(pathname)) {
    return NextResponse.next();
  }

  // cờ thoát hiểm CHỈ cho dev, KHÔNG BAO GIỜ true ở production
  if (process.env.NODE_ENV !== 'production' && process.env.APP_ALLOW_DEV_SESSION === '1') {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE) || req.cookies.has(SSO_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```
- `matcher` bỏ qua asset tĩnh + `/api` (route API tự guard bằng hàm `ensure()`/`requirePermission()` riêng, không qua middleware).
- Đổi biến môi trường (khi hạ tầng build lại middleware inline) phải rebuild để nhận giá trị mới — đừng tưởng đổi env runtime là đủ trên mọi nền triển khai.

### 2. Màn đăng nhập TỬ TẾ (`app/login/page.tsx`)
**Full-screen** (`position:fixed; inset:0; z-index:1100` — phủ luôn sidebar cũ, khỏi refactor layout), nền gradient thương hiệu, card căn giữa: logo + tagline · ô Email/Mật khẩu **CÓ NHÃN** + `autoComplete`/`autoFocus` · nút full-width · báo lỗi rõ ràng (không lộ câu kỹ thuật) · dòng "liên hệ quản trị" khi không tự đăng ký được.

### 3. Nhận diện đăng nhập ĐA-COOKIE (`sessionDisplay()`)
Xét **cả 2** cookie (phiên nội bộ ưu tiên + SSO nếu có), lấy thông tin hiển thị, **best-effort KHÔNG ném lỗi** (DB lỗi không được làm vỡ trang). Bẫy hay gặp: layout chỉ xét 1 loại cookie → đăng nhập bằng cách còn lại vẫn hiện nút "Đăng nhập". Sidebar/topbar phải ẩn menu khi chưa đăng nhập (`{loggedIn && <nav/>}`), không chỉ dựa vào middleware.

---

## B. Xác minh JWT phiên — chọn cách theo THUẬT TOÁN KÝ

Khi trang/middleware/API cần biết "ai đang đăng nhập" từ access token, có **2 cách** — chọn theo cấu hình ký của hạ tầng auth, không cách nào sai tuyệt đối:

```ts
// (A) verify HS256 cục bộ — chỉ ĐÚNG khi hạ tầng còn ký bằng shared secret
import { jwtVerify } from 'jose';

export async function verifyLocalHS256(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  return payload;
}
```

```ts
// (B) verify qua endpoint auth provider — hợp MỌI thuật toán + tự chịu xoay khoá
import { cache } from 'react';

export const verifyViaProvider = cache(async (token: string) => {
  const res = await fetch(`${process.env.AUTH_API_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('invalid session');
  return res.json();
});
```

- **(A) HS256 cục bộ**: nhanh, 0 round-trip mạng. Chỉ đúng khi project còn ký JWT bằng HS256 (shared secret) — cấu hình mặc định của nhiều nền tảng auth-as-a-service.
- **(B) Verify qua endpoint**: gọi thẳng auth provider xác thực token → tự verify hợp mọi thuật toán + tự chịu xoay khoá về sau. Dedup 1-request-1-lần-gọi bằng cache (`React.cache()`/tương đương) để không gọi lặp trong 1 lượt render.
- 🚩 **Cờ chọn quan trọng:** nếu hạ tầng đã **xoay khoá ký sang thuật toán bất đối xứng (ECC/RSA)** → **PHẢI dùng (B)**. Verify HS256 cục bộ sẽ **GÃY LOGIN**: secret cũ khi đó chỉ còn là "previous key" (ký token cũ sắp hết hạn), token MỚI ký bằng khoá bất đối xứng → verify HS256 fail → đá người dùng ra dù mật khẩu đúng. Đây là lỗi ÂM THẦM, rất dễ tưởng nhầm "sai mật khẩu".
- Cách biết dùng cách nào: xem cấu hình JWT keys của auth provider — thấy thuật toán bất đối xứng (vd "ECC (P-256)") → dùng (B); còn "shared secret"/HS256 → (A) vẫn ổn, nhẹ hơn. Nghi ngờ, hoặc build SaaS bán cho nhiều khách hàng có thể tự cấu hình khác nhau → **mặc định chọn (B)** cho an toàn xoay-khoá tương lai.

---

## C. Auth-guard trang phải REDIRECT, KHÔNG được throw trần

🔴 Bẫy gây sập production thật (chỉ hiện "Application error", không rõ lý do): middleware chỉ kiểm cookie **CÓ MẶT** (thô, chạy Edge) — cookie còn nhưng **token đã HẾT HẠN** → middleware vẫn cho qua → trang gọi hàm lấy phiên (`getAccessContext()`) → hàm **ném lỗi** → framework ở chế độ production biến throw thành trang lỗi chung chung, giấu nguyên nhân thật (chỉ còn 1 mã digest, phải xem log server mới thấy lỗi gốc).

```ts
// lib/require-access.ts
import { redirect } from 'next/navigation';
import { getAccessContext } from './session';

export async function requireAccess() {
  try {
    return await getAccessContext(); // ném lỗi nếu token hỏng/hết hạn
  } catch {
    redirect('/login'); // KHÔNG để lỗi thoát ra ngoài dạng throw trần
  }
}
```

- Mọi `page.tsx` cần biết "ai đang đăng nhập" phải gọi qua `requireAccess()`, KHÔNG gọi thẳng hàm có thể ném. Lưu ý: helper này dùng trong page — server action/route API KHÔNG dùng (redirect không hợp lệ ở đó), action phải trả `{ok:false, error}` theo lỗi chuẩn.
- Lỗi này TIỀM ẨN ở mọi trang có gọi context, chỉ lộ khi có ít nhất 1 trang gọi (trang trơ không gọi thì không lộ) — nên đừng chủ quan vì "chưa thấy lỗi".
- Verify local trước khi deploy: giả lập cookie hết hạn/giả → phải thấy **redirect về /login**, không phải trang lỗi 500.

---

## 📋 Checklist
- [ ] `middleware.ts` gác đủ route (trừ asset tĩnh + `/api`); test anon vào mọi trang → **redirect (307) → /login**, `/login` trả 200.
- [ ] Màn `/login` full-screen, ô có nhãn + autofocus, báo lỗi không lộ chi tiết kỹ thuật.
- [ ] `sessionDisplay()`/tương đương xét ĐỦ mọi loại cookie phiên; sidebar/topbar ẩn nav khi chưa đăng nhập.
- [ ] Xác định đúng thuật toán ký JWT của hạ tầng auth → chọn (A) hay (B); nếu không chắc → chọn (B).
- [ ] Mọi trang cần phiên dùng `requireAccess()` (redirect), không gọi thẳng hàm có thể throw.
- [ ] Test thật sau khi deploy: đăng nhập tài khoản thật + cookie hết hạn/giả → thấy đúng hành vi redirect, không phải trang lỗi.

## ⚠️ Cạm bẫy
- Chặn dữ liệu mà quên chặn khung → anon vẫn thấy sidebar/tên/đếm dù số liệu đã khoá.
- Layout chỉ xét 1 loại cookie phiên → đăng nhập bằng cách còn lại vẫn hiện nút "Đăng nhập".
- Verify HS256 cục bộ khi hạ tầng đã xoay sang khoá bất đối xứng → đá người dùng ra âm thầm, dễ tưởng "sai mật khẩu".
- Trang gọi hàm lấy phiên có thể ném lỗi mà không bọc `requireAccess()` → production hiện "Application error" chung chung, giấu nguyên nhân thật.
- Đổi biến môi trường mà không rebuild (trên hạ tầng inline-env-lúc-build) → middleware vẫn chạy giá trị cũ.

## 🔗 Liên quan
- `29-rbac-phan-quyen-chuan.md` — phân quyền SAU khi đã qua cổng đăng nhập.
- `30-harness-e2e-playwright.md` — test tự động luồng anon→login→app.
- `04-rate-limit.md` — chống dò mật khẩu (rate-limit + khoá tạm sau N lần sai).
