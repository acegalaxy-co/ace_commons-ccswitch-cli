# 31 — Kiểm thử hình ảnh/giao diện 3 tầng leo thang

🎯 **Vấn đề:** 1 bài E2E smoke kiểu "trang trả về 200" không đủ để bắt lỗi giao diện — chữ tràn/cắt, ảnh vỡ, layout lệch, nhãn biểu đồ bị cắt vẫn lọt qua vì không có phép đo hình ảnh nào cả. Nhưng dựng lưới pixel-diff cho MỌI màn ngay từ đầu thì baseline vỡ liên tục, CI đỏ oan, team tắt lưới.

Bài này giải quyết gì: kim tự tháp 3 tầng leo thang từ rẻ-xác-định (T1) đến đắt-xác-suất (T3), nguyên tắc vận hành để lưới không bị tắt, và 1 lưu ý đóng gói quan trọng cho thư viện dùng ở test-time.

---

## A. Kim tự tháp 3 tầng

| Tầng | Cách làm | Chi phí | Có chặn merge? |
|---|---|---|---|
| **T1 — Geometry** | Đo hình học DOM: không tràn ngang, chữ bị cắt ngoài ý muốn, ảnh vỡ, phần tử 0-kích-thước, nút hành động nằm trong khung nhìn, canvas lấp đủ khung chứa | 0 baseline, rẻ | Có — chặn CI |
| **T2 — Pixel-diff nhốt** | So khớp ảnh vài màn "bộ mặt" (dashboard/biểu đồ/login/thanh toán) với mock data cố định | Baseline phải bảo trì | Có — gate hẹp, chỉ vài màn |
| **T3 — AI-vision** | AI đọc ảnh chấm điểm giao diện, chạy theo lịch | Tốn nhất, chậm nhất | Không — chỉ báo cáo |

### T1 — Geometry (đo DOM, 0 baseline)
Cắm vào đúng vòng lặp `screens-smoke` đã có sẵn (xem `30-harness-e2e-playwright.md`). Bộ phép đo gợi ý:
- Không tràn ngang: `el.scrollWidth <= el.clientWidth`.
- Chữ bị cắt ngoài ý muốn: `scrollWidth > clientWidth` MÀ không có `text-overflow: ellipsis` khai báo.
- Ảnh vỡ: `naturalWidth === 0` hoặc response tải ảnh ≥ 400.
- Phần tử 0-kích-thước (control tưởng hiện mà thực ra cao/rộng = 0).
- Nút hành động chính nằm trong viewport.
- Chạy ở ít nhất 3 viewport (mobile/tablet/desktop) — lỗi responsive chết ở đây, chi phí gần như 0.
- 🔴 **Điểm mù:** nếu biểu đồ vẽ bằng **canvas** (thư viện chart render canvas, không phải SVG), DOM không có node chữ để đo → geometry KHÔNG bắt được nhãn trục bị cắt bên trong canvas. Cách vá: (a) ép chart render SVG khi chạy test (nếu thư viện hỗ trợ, bật qua cờ môi trường) để geometry đo được nhãn; hoặc (b) đẩy đúng những màn có canvas sang T2 pixel-diff với dữ liệu cố định. Không làm 1 trong 2 thì lỗi kiểu "nhãn trục bị cắt" vẫn lọt dù bộ test T1 báo xanh.

### T2 — Pixel-diff nhốt (5-10 màn "bộ mặt")
- Chỉ áp cho vài màn giá trị cao (dashboard, biểu đồ, đăng nhập, thanh toán) — không phủ toàn bộ app.
- **Mock data CỐ ĐỊNH** (bắt buộc cho màn có biểu đồ/số liệu động) + mask vùng thật sự động (đồng hồ, id ngẫu nhiên) + tắt animation.
- Baseline chỉ được **sinh và so sánh trên cùng 1 hệ điều hành** (thường là Linux trong CI) — font khác hệ điều hành sẽ tạo sai-số dương giả, làm lưới mất tin cậy.
- Ngưỡng lệch nhỏ (khoảng dưới 1% số pixel) để chừa sai số render vặt vãnh nhưng vẫn bắt được lệch layout thật.
- Cập nhật baseline = 1 lệnh (đừng bắt người review tự sửa ảnh tay).

### T3 — AI-vision (không chặn merge)
- Chạy theo lịch (nightly), không đứng chắn đường merge — vì còn xác suất sai (false positive/negative).
- Dùng để triage khi T2 pixel-diff báo lệch (giúp người review hiểu "lệch cái gì") và quét rộng những màn chưa có baseline T2.
- 🎯 **Việc quan trọng nhất không phải viết prompt hay, mà là bộ ảnh mẫu đã gán nhãn (golden set)** — khoảng 30-50 ảnh (gồm cả ảnh có lỗi thật lẫn ảnh sạch dễ gây nhầm) — để đo độ chính xác/độ phủ (precision/recall) theo TỪNG loại lỗi trước khi tin kết quả AI. Có rubric đóng (danh sách cố định các loại lỗi cần bắt: chữ cắt, tràn, đè lên nhau, ảnh vỡ, méo hình, khoảng trắng bất thường, bị che) + danh sách rõ ràng "không tính là lỗi" để giảm báo nhầm.
- Thang tin cậy tăng dần: chỉ báo cáo → gợi ý chặn nhẹ → chặn hẳn cho từng loại lỗi ĐÃ đo được precision đủ cao trên đủ số mẫu — không nhảy thẳng lên "chặn" khi chưa đo.

## B. Nguyên tắc vận hành để lưới không bị tắt

1. **Report-only TRƯỚC, gate SAU.** Bật chặn CI ngay ngày đầu → đỏ oan hàng loạt vì ngưỡng chưa tinh → team tắt hẳn lưới. Chạy chế độ chỉ-báo-cáo một thời gian, tinh chỉnh ngưỡng, có danh sách miễn-trừ-có-lý-do rồi mới bật gate.
2. **Route tự quét + gate độ phủ.** Tự sinh danh sách route từ router thật của app (không dựa vào người viết nhớ tay) — route mới không có test smoke và không có lý do bỏ qua rõ ràng → CI phải đỏ. Đóng vĩnh viễn kiểu "độ phủ theo trí nhớ".
3. **"Lưới phải có răng."** Không tin 1 rule kiểm tra chỉ vì nó đang xanh — mỗi rule phải có ít nhất 1 "mẫu lỗi cấy sẵn" (fixture chứa đúng loại lỗi rule đó cần bắt) và tự kiểm rule phải báo ĐỎ trên mẫu đó, chạy trong CI của chính bộ kiểm tra. Với lỗi thật gặp trong sản phẩm: viết test tái hiện lỗi đó → xác nhận test ĐỎ đúng lỗi → sửa → giữ nguyên test lại vĩnh viễn (không xoá sau khi xanh).
4. **Tự cách ly test hay chập chờn (flake).** Test lệch/fail ngẫu nhiên vượt một ngưỡng trong khoảng thời gian gần đây → tự động rớt khỏi hàng chặn merge, chuyển về chạy theo lịch (nightly) chờ người xem lại — đừng để 1 test hay flake làm cả team mất niềm tin vào toàn bộ lưới.
5. **AI duyệt vòng-1 thay người, người chỉ duyệt phần còn nghi.** Khi có lệch T2, để AI so ảnh trước/sau + đọc mô tả thay đổi rồi nhận định "đây có phải chủ đích không" trước, người chỉ cần xác nhận nhanh — thay vì bắt người soi từng pixel trong mọi PR. Chỉ giữ bước duyệt thủ công bắt buộc ở các màn "giá trị cao" (thanh toán, đăng nhập...).

## C. Lưu ý đóng gói — thư viện dùng ở TEST-TIME phải build sẵn

Nếu rút phần dùng chung (helper đo geometry, wrapper pixel-diff...) thành 1 package tái sử dụng giữa nhiều dự án:

- 🔴 **Thư viện dùng bởi test-runner (Playwright/Jest...) PHẢI build ra JS + file khai báo kiểu (`.d.ts`)**, KHÔNG ship mã nguồn thô (TypeScript chưa biên dịch). Lý do: bundler ứng dụng (dùng lúc build app thật) có cơ chế tự biên dịch package nội bộ, nhưng **test-runner không có cơ chế tương đương** — import mã nguồn thô nằm trong thư mục phụ thuộc sẽ lỗi ngay ở bước thu thập test ("không hỗ trợ biên dịch file trong thư mục phụ thuộc"). Quy tắc "ship mã nguồn thô, để bundler runtime tự dịch" chỉ đúng cho package dùng ở RUNTIME app, không áp dụng được cho package dùng ở TEST-TIME.
- 🔴 **"Consumer đầu tiên" là bài kiểm bắt buộc trước khi phát hành package.** Đóng gói xong, đóng thành gói cục bộ rồi CÀI THẬT vào 1 dự án tiêu thụ (không chạy trong cùng monorepo) trước khi publish lên registry thật — bước này lộ ra lỗi mà kiểm tra kiểu (typecheck) và test nội bộ trong monorepo KHÔNG thấy được, vì trong monorepo test-runner có thể đang biên dịch trực tiếp từ mã nguồn cục bộ (khác hẳn hành vi khi cài qua thư mục phụ thuộc thật).

## 📋 Checklist
- [ ] T1 geometry cắm vào vòng lặp smoke sẵn có, chạy ≥3 viewport, chặn CI ngay (rẻ, 0 baseline).
- [ ] Xác định màn có canvas/chart → xử điểm mù (ép SVG khi test, hoặc đẩy sang T2 pixel-diff mock data cố định).
- [ ] T2 pixel-diff chỉ áp cho 5-10 màn giá trị cao, baseline sinh/so trên cùng hệ điều hành, mask vùng động.
- [ ] T3 AI-vision không chặn merge, chạy theo lịch, có golden set đo precision/recall theo từng loại lỗi trước khi tăng mức tin cậy.
- [ ] Report-only trước khi bật gate; route tự quét + gate độ phủ; mỗi rule có fixture tự-kiểm phải đỏ đúng lỗi của nó.
- [ ] Flake tự động cách ly khỏi hàng chặn merge sau khi vượt ngưỡng.
- [ ] Package dùng ở test-time build ra JS+`.d.ts`; thử cài thật vào 1 dự án tiêu thụ trước khi publish.

## ⚠️ Cạm bẫy
- Biểu đồ vẽ bằng canvas → geometry không đo được nhãn bên trong, lỗi cắt chữ trong chart vẫn lọt dù T1 xanh.
- Baseline pixel-diff sinh trên hệ điều hành khác lúc so sánh → sai số font giả, lưới mất tin cậy, người ta bắt đầu bỏ qua cảnh báo thật.
- Bật gate ngay từ ngày đầu chưa tinh chỉnh ngưỡng → CI đỏ oan hàng loạt → team tắt hẳn lưới.
- Tin rule kiểm tra đang xanh mà chưa từng thấy nó đỏ đúng trên 1 mẫu lỗi cấy sẵn.
- Cho AI-vision chặn merge trực tiếp khi chưa đo precision/recall trên golden set → chặn nhầm hàng loạt hoặc bỏ lọt lỗi thật.
- Ship package dùng ở test-time dưới dạng mã nguồn thô (tưởng giống package runtime) → cài thật vào dự án khác sẽ lỗi ngay bước thu thập test.
- Publish package thẳng sau khi test trong monorepo xanh, bỏ qua bước cài thử ở dự án tiêu thụ ngoài monorepo → lỗi chỉ lộ ra sau khi đã publish.

## 🔗 Liên quan
- `30-harness-e2e-playwright.md` — vòng lặp smoke nơi T1 geometry cắm vào.
- `11-dam-bao-chat-luong-4-luoi.md` — vị trí kiểm hình ảnh trong tổng thể nhiều lưới.
- `21-ci-tiet-kiem-chi-phi.md` — dồn phần nặng (T3, pixel-full) ra khỏi PR để giữ CI rẻ.
