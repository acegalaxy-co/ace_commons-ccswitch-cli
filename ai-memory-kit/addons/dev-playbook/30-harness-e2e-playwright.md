# 30 — Harness E2E Playwright chuẩn

🎯 **Vấn đề:** app web (React/Vite hoặc Next.js) cần phủ tự động luồng UI thật (không chỉ backend/API), nhưng viết E2E tay cho từng nút bấm form login rất chậm và dễ vỡ vì tour/onboarding/popup che nút, OTP bị throttle, hay chạy song song thì phiên đăng nhập tự đá nhau.

Bài này giải quyết gì: khuôn kiến trúc harness tái dùng (mục A), 3 biến thể cách app "vào phiên" tuỳ kiểu nạp app (mục B), và loạt bẫy chỉ lộ khi test THẬT SỰ click/tương tác — không phải chỉ assert-hiển-thị (mục C).

---

## A. Kiến trúc chuẩn

### Khi nào dùng
App web (React/Vite, hoặc Next.js) cần phủ tự động luồng UI bằng cách click qua màn thật. Không thay thế test luồng nghiệp vụ/RBAC ở tầng backend (giữ nguyên ở unit/integration test) — harness này phủ tầng KỊCH BẢN UI mà test backend không chạm.

### Cấu trúc file
```
<repo>/playwright.config.ts     # projects: setup → app; webServer chạy dev server; screenshot/trace/html
<repo>/e2e/
  auth.setup.ts                 # login qua API → lưu storageState (gitignored)
  helpers/env.ts                # cấu hình qua biến môi trường, KHÔNG hardcode secret
  helpers/login.ts              # login dùng chung
  routes.ts                     # danh sách route (rút từ router thật của app)
  screens-smoke.spec.ts         # smoke tham số hoá N màn
  <section>.spec.ts             # test sâu từng màn/luồng
```

### 7 nguyên tắc
1. Đặt harness ở **GỐC repo** (nhất là monorepo nhiều app) — 1 harness phủ nhiều app, thêm app sau chỉ đổi `baseURL` + cấu hình auth.
2. **Auth 1 LẦN qua API, không bấm form** → lưu `storageState`. App dùng token (localStorage): gọi API login lấy token → `page.goto(origin)` → `page.evaluate` set đúng key mà app đọc (đọc code auth provider của app để biết tên key) → lưu `storageState`. App dùng cookie thì storageState tự bắt cookie, khỏi bước set localStorage.
3. Có kênh login nhanh cho môi trường test (ví dụ OTP trả sẵn mã ở môi trường không phải production) — nhưng phải có **lằn dự phòng bằng mật khẩu thật** (biến môi trường riêng cho tài khoản test), vì kênh nhanh thường bị TẮT khi hạ tầng siết chặt trước khi phát hành thật; nếu chỉ có 1 đường thì harness sẽ gãy đúng lúc cần chạy nhất.
4. **Không hardcode secret/credential** — mọi thứ (email/URL/password) qua biến môi trường, có giá trị mặc định trỏ môi trường dev. Trỏ nhầm sang production (không có kênh nhanh) → harness phải DỪNG và báo rõ, không âm thầm chạy sai.
5. **Chụp màn hình MỖI test** + trace-khi-lỗi + report HTML — đừng chỉ tin PASS/FAIL, cần "nhìn thấy" trạng thái thật. Artifact vào `.gitignore`.
6. **Phủ RỘNG trước, SÂU sau**: bước 1 `screens-smoke` tham số hoá danh sách route (rút từ router/danh mục màn của app) — mỗi màn kiểm: không văng về `/login` · khung app render được · có nội dung UI thật · **0 lỗi JS runtime** (bắt sự kiện `pageerror`) · chụp màn. Bước 2 mới thêm test SÂU từng thao tác (CRUD, filter...) cho từng màn quan trọng.
7. `webServer` tự bật dev server của app kèm `reuseExistingServer: !CI` — trỏ backend môi trường dev có sẵn, khỏi dựng backend local riêng cho việc chạy E2E.

```ts
// e2e/auth.setup.ts (khung tối giản)
import { test as setup } from '@playwright/test';
import { loginViaApi } from './helpers/login';

const AUTH_FILE = '.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  const { token } = await loginViaApi(request);
  await page.goto(process.env.APP_BASE_URL!);
  await page.evaluate((t) => localStorage.setItem('app_token', t), token);
  await page.context().storageState({ path: AUTH_FILE });
});
```

```ts
// e2e/screens-smoke.spec.ts (khung tham số hoá)
import { test, expect } from '@playwright/test';
import { routes } from './routes';

for (const route of routes) {
  test(`màn ${route.name} mở được, không văng login, không lỗi JS`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(route.path);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
    await page.screenshot({ path: `test-results/screens/${route.name}.png`, fullPage: true });

    expect(errors, `lỗi JS runtime ở ${route.name}: ${errors.join('; ')}`).toHaveLength(0);
  });
}
```

## B. 3 biến thể "vào phiên" theo kiểu nạp app

| Biến thể | Đặc điểm |
|---|---|
| **Vite/SPA (token localStorage)** | login qua API lấy token → set đúng key localStorage app đọc → storageState bắt lại được. |
| **RN-Web (Expo export web)** | build cần "nướng sẵn" biến môi trường API lúc BUILD (không đổi được lúc serve) → build trước, serve `dist/` sau; login qua UI bằng `testID` (không có authProvider API tiện như web admin), token cũng ở localStorage. |
| **Next.js + cookie (có cờ dev-bypass)** | storageState tự bắt cookie; nếu có cờ bật sẵn phiên cho môi trường dev thì auth.setup chỉ cần set thêm cờ "đã xem tour" — không cần mật khẩu. ⚠️ Cờ dev-bypass CHE mất bug thật ở luồng chưa-đăng-nhập → phải có project test RIÊNG chạy với bypass TẮT để kiểm màn login/asset/redirect thật. |

## C. Bẫy chỉ lộ khi test TƯƠNG TÁC (click) — smoke assert-hiển-thị không bắt được

- 🅱 **Tour/overlay onboarding phủ mask toàn màn → chặn MỌI click.** Assert-hiển-thị vẫn qua (phần tử "visible"), nhưng test click sẽ treo vì bị overlay chặn sự kiện con trỏ. Fix: nạp sẵn cờ "đã xem tour" vào `storageState` lúc `auth.setup` (tìm đúng key cờ trong code component tour).
- 🅱 **Throttle gửi lại OTP** (backend chặn xin mã lại trong khoảng thời gian ngắn) → chạy harness liên tục sẽ fail ở bước login. Fix: `auth.setup` tái dùng token còn hạn (đọc `storageState` cũ, giải mã `exp`, chừa đệm vài phút) — chỉ đăng nhập lại khi thiếu/gần hết hạn.
- 🅱 **Đua xoay-vòng refresh-token khi chạy SONG SONG**: nếu tái dùng `storageState` có access-token đã hết hạn, MỌI tab cùng gọi refresh lúc khởi động → backend xoay vòng refresh-token → tab đầu đổi được, các tab sau dùng refresh-token cũ đã vô hiệu → bị đá "phiên hết hạn" (trông giống lỗi overlay lạ). Fix: `auth.setup` kiểm hạn access-token đã lưu, hết/sắp hết thì ĐĂNG NHẬP LẠI lấy token tươi phủ trọn suite thay vì để mỗi tab tự refresh lúc chạy.
- 🅱 **Popup điều khoản/thông báo che nút, không đóng ngang được** (chỉ hiện ở 1 màn, sau một khoảng trễ bất định) — kiểm ngay lập tức sẽ trượt vì popup mount sau. Fix: (a) set trước cờ "đã đồng ý" trong `auth.setup` nếu có thể; (b) mọi test có tương tác ở màn đó vẫn nên có bước phòng thủ "chờ popup xuất hiện rồi đóng nếu có" trước khi thao tác tiếp.
- **Strict-mode locator trùng tên** (tiêu đề trang trùng nhãn menu) → ưu tiên locator theo **role** (`getByRole('heading', {name})`) hơn là match text trần; dùng `{exact: true}` khi có nhãn là tiền tố của nhãn khác ("Tìm" vs "Tìm nhanh").
- **Test SÂU trên dữ liệu dùng chung phải AN TOÀN**: mở modal + submit trống để test validate (không ghi), KHÔNG bấm nút ghi-tiền/xoá/gửi-thật; muốn test đường ghi thật → dùng CSDL cô lập riêng cho CI, đừng ghi vào môi trường chia sẻ.
- Khớp placeholder/text theo **substring** (2 ô cùng chứa 1 từ khoá) → luôn dùng `{exact: true}` hoặc locator role thay vì đoán text.

## 📋 Checklist
- [ ] Auth qua API 1 lần, lưu `storageState`; set đúng key localStorage/cookie mà app thực sự đọc.
- [ ] `screens-smoke` tham số hoá từ danh sách route thật của app, bắt `pageerror`, chụp màn mỗi test.
- [ ] Có kênh login nhanh cho môi trường test + lằn dự phòng bằng mật khẩu thật khi kênh nhanh bị tắt.
- [ ] Nạp sẵn cờ tour/điều khoản đã đồng ý vào storageState nếu có onboarding chặn click.
- [ ] Kiểm hạn access-token trước khi chạy song song — refresh/login lại nếu gần hết hạn.
- [ ] Test sâu không ghi/xoá dữ liệu thật trên môi trường dùng chung.

## ⚠️ Cạm bẫy
- Set sai key localStorage → app tưởng chưa đăng nhập, đá về `/login` dù storageState có vẻ đúng.
- Tour/overlay che toàn màn → test click treo "intercepts pointer events" dù assert-hiển-thị vẫn xanh.
- Chạy song song với token gần hết hạn → refresh-token đua nhau, tab sau bị đá phiên.
- Bấm nút ghi/xoá thật trong test sâu trên CSDL dùng chung → không có nút hoàn tác sạch.
- Tin "CI xanh" mà chưa từng thấy test đó ĐỎ đúng lỗi ít nhất 1 lần trước khi merge.

## 🔗 Liên quan
- `28-cong-dang-nhap-chuan.md` — cổng đăng nhập mà harness này phải test qua được (anon → login → app).
- `31-kiem-thu-hinh-anh-3-tang.md` — cắm thêm lớp kiểm hình ảnh vào đúng vòng lặp `screens-smoke` này.
- `11-dam-bao-chat-luong-4-luoi.md` — vị trí của lớp E2E trong tổng thể nhiều lưới kiểm.
