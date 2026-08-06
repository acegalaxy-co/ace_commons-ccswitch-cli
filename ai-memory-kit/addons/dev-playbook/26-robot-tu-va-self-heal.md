# 26 — Robot tự-vá (self-heal) có lưới an toàn

🎯 **Vấn đề:** Muốn một engine tự phát hiện lỗi, tự đề xuất/áp bản vá, và tự merge khi đủ điều kiện — để giảm việc tay cho người vận hành. Nhưng "tự sửa code + tự đẩy lên" mà không có lưới an toàn là công thức cho 1 con robot sửa sai hàng loạt, đặc biệt nguy hiểm nếu nó chạm vào vùng tiền. Bài này gom 4 lằn ranh bắt buộc + điều kiện cụ thể để auto-merge, và ranh giới giữa "tự merge vào nhánh phát triển" với "tự đẩy lên production".

## Kiến trúc nền (nhắc nhanh — chi tiết ở `09-observability-autofix.md`)
Self-heal luôn đứng trên 1 tầng quan sát: mỗi service có 1 đầu báo lỗi nhẹ, gửi lỗi giàu ngữ cảnh (kèm fingerprint gộp trùng, đã rửa PII) về 1 hộp lỗi trung tâm. Robot tự-vá là bước đi tiếp từ hộp lỗi đó: đọc lỗi → đề xuất bản vá → (nếu đủ điều kiện) tự áp dụng. Bài này tập trung vào phần "đủ điều kiện" đó.

## 4 lằn ranh bắt buộc trước khi bật "tự vá + tự merge"

### 1. Chỉ tự-vá mức NHẸ NHẤT mà cổng phân loại tự động thả ra
Đừng để robot tự nới quyền lên mức nặng hơn mức đã được xếp loại "an toàn để tự động". Nếu cổng phân loại chỉ xếp mức "lỗi nhẹ, không đụng tiền" vào diện tự-vá được, robot KHÔNG được tự áp dụng cho lỗi mức nặng hơn dù bản vá "trông có vẻ đơn giản". Và nếu cùng 1 dấu vân tay lỗi (fingerprint) đã được vá rồi mà TÁI PHÁT, đó là tín hiệu bản vá trước sai hoặc chưa trúng gốc — lần này KHÔNG tự-merge nữa, trả về cho người xem lại.

### 2. Fail-safe cho vùng tiền — nghi thì coi là tiền
Bộ máy dò "đây có phải vùng tiền không" (theo đường dẫn file, theo module, theo đồ thị import) luôn có ĐIỂM MÙ — chỉ đáng tin cho đúng loại file nó thực sự quét được (vd file `.ts` trong thư mục nguồn). Bất kỳ thay đổi nào NGOÀI phạm vi nó quét được — file migration DB, file cấu hình `.json/.env/.yml`, import xuyên qua alias đường dẫn — mặc định phải coi là "cần người duyệt", không phải "đã quét sạch nên an toàn". Nguyên tắc lật ngược mặc định: không phải "trừ khi phát hiện tiền thì mới chặn", mà là "trừ khi CHẮC CHẮN không phải tiền mới cho qua". Đọc kết quả kiểm tra bằng exit code / kết quả có cấu trúc, không suy luận qua so khớp chuỗi text.

### 3. Bắt buộc có cầu chì + đường lùi TRƯỚC khi bật
- **Cầu chì (circuit breaker):** trần số lần tự-merge cho phép trên CÙNG 1 fingerprint (vd ≥2 lần tái phát → tự động dừng, không thử vá lần 3), và trần số lần tự-merge cho phép mỗi ngày trên toàn hệ thống.
- **Đường lùi (rollback):** trước mỗi lần tự-push, ghi lại điểm mốc (commit/SHA) của trạng thái nền trước đó, kèm 1 script rollback chạy được bằng 1 lệnh. Người vận hành non-tech không tự gõ lệnh git — họ chỉ cần bật 1 công tắc "dừng khẩn cấp" và báo cho trợ lý AI xử lý tiếp.
- Lưu ý: công tắc dừng khẩn cấp chỉ chặn hành động TƯƠNG LAI, không tự lùi những gì đã lỡ đẩy lên — rollback là bước riêng, phải test trước khi cần dùng thật.

### 4. Cờ bật/tắt theo TỪNG dự án, tự tắt khi thiếu đồ nghề
Đừng bật tự-merge như 1 công tắc toàn hệ thống. Mỗi dự án có cờ riêng, chỉ được bật khi dự án thực sự có đủ: guard dò vùng tiền + lệnh verify có test thật (không chỉ build pass). Trước khi bật thật, nên có giai đoạn "tập sự": vài ca thật để trợ lý AI soi diff, người vận hành xác nhận từng kết luận đúng/sai — rồi mới bật.

Một ranh giới không thể kiểm tra chỉ bằng đọc code trong repo: ví dụ nhánh này thực sự nối tới môi trường DEV hay PRODUCTION là cấu hình nằm ở bảng điều khiển của nền tảng triển khai, không nằm trong file cấu hình repo. Loại thông tin này phải xác nhận NGOÀI repo (chụp màn hình dashboard, hỏi trực tiếp người quản lý hạ tầng) trước khi cho robot có quyền tự push.

## Điều kiện cụ thể để 1 bản vá được tự-merge
Một bản vá chỉ được tự-merge khi ĐỦ CẢ:
- [ ] Fingerprint được xếp loại "không đụng tiền" bởi cổng phân loại (không phải robot tự quyết)
- [ ] Fingerprint này CHƯA từng tái phát sau 1 lần vá trước (nếu tái phát → về người)
- [ ] Build + test tự động xanh
- [ ] Có 1 lượt review tự động thứ 2 (reviewer AI độc lập hoặc rule-based) đồng ý
- [ ] Chưa chạm trần số lần tự-merge/ngày và trần tái phát/fingerprint
- [ ] Diff không chạm file ngoài phạm vi guard dò vùng tiền quét được
- [ ] Có nút Lùi-bản sẵn sàng + đã ghi SHA mốc trước khi push
- [ ] Sau khi merge, có báo cáo tự động (fingerprint gì, diff gì, ai/gì duyệt)

## Auto-merge vào DEV ≠ cổng go-live production
Đây là ranh giới hay bị nhầm: "làm xong + CI xanh thì tự merge" là quy tắc hợp lý cho việc **đẩy PR vào nhánh phát triển** (main/dev của repo code) — một bước đương nhiên trong luồng dev bình thường, không cần hỏi lại mỗi lần. Nhưng việc đó HOÀN TOÀN KHÁC với **đưa bản vá lên môi trường production thật** (nơi người dùng thật đang chạy). Dù engine tự-vá mạnh tới đâu, bước go-live production luôn cần một cổng duyệt của người có thẩm quyền — không có ngoại lệ "vì lỗi này nhỏ" hay "vì đã tự-merge DEV được rồi". Tương tự, các thao tác xoá/khó đảo ngược khác (drop bảng, đổi trạng thái tiền, thay đổi PII) không nằm trong phạm vi "auto-merge khi xong", dù CI có xanh.

## 💻 Code mẫu — cấu hình cầu chì theo dự án (khung tham khảo)
```ts
// self-heal-policy.ts
type ProjectSelfHealPolicy = {
  autoMergeEnabled: boolean;       // cờ riêng theo dự án, mặc định false
  maxAutoMergesPerDay: number;     // trần/ngày
  maxRecurrenceBeforeStop: number; // ≥N lần tái phát cùng fingerprint → dừng
  moneyGuardScopeGlobs: string[];  // phạm vi guard THỰC SỰ quét được
  requiresGreenTests: boolean;     // không chỉ build, phải có test thật
};

function canAutoMerge(patch: PatchProposal, policy: ProjectSelfHealPolicy, stats: DailyStats) {
  if (!policy.autoMergeEnabled) return { ok: false, reason: 'disabled-for-project' };
  if (patch.severity !== 'non-money-low') return { ok: false, reason: 'severity-too-high' };
  if (patch.recurrenceCount >= policy.maxRecurrenceBeforeStop) return { ok: false, reason: 'recurred' };
  if (stats.autoMergesToday >= policy.maxAutoMergesPerDay) return { ok: false, reason: 'daily-cap' };
  const touchesOutOfScope = patch.filesChanged.some(f => !matchesAnyGlob(f, policy.moneyGuardScopeGlobs));
  if (touchesOutOfScope) return { ok: false, reason: 'file-outside-guard-scope' }; // fail-safe: nghi thì chặn
  if (policy.requiresGreenTests && !patch.testsGreen) return { ok: false, reason: 'tests-not-green' };
  return { ok: true };
}
```

## 📋 Checklist trước khi bật tự-merge cho 1 dự án
- [ ] Cổng phân loại mức độ lỗi tách rõ "không-tiền" vs "chạm-tiền", không để robot tự quyết mức
- [ ] Guard dò vùng tiền có phạm vi quét RÕ (liệt kê glob), mọi file ngoài phạm vi mặc định bị chặn
- [ ] Trần tái phát/fingerprint + trần tự-merge/ngày đã cấu hình
- [ ] Có script rollback test-được + ghi SHA mốc mỗi lần tự-push
- [ ] Có công tắc dừng khẩn cấp mà người non-tech tự bấm được
- [ ] Cờ bật theo TỪNG dự án, đã qua giai đoạn tập sự (vài ca thật được xác nhận đúng)
- [ ] Thông tin không đọc được từ repo (nhánh nối env nào) đã xác nhận ngoài repo
- [ ] Auto-merge DEV có luồng riêng, KHÔNG dùng chung cổng với go-live production

## ⚠️ Cạm bẫy
- Coi "guard dò vùng tiền không báo gì" là bằng chứng an toàn — guard chỉ quét được phạm vi nó biết, im lặng ≠ sạch.
- Bật tự-merge toàn hệ thống thay vì theo từng dự án — dự án chưa có test thật cũng bị cuốn theo.
- Không phân biệt "tái phát" với "lỗi mới" — vá lặp lại 1 lỗi vẫn tái phát mà không rung chuông dừng lại.
- Nhầm "auto-merge vào main repo code" với "đã được phép tự deploy production" — 2 cổng khác nhau, cổng sau luôn cần người duyệt.
- Không ghi SHA mốc trước khi tự-push — muốn lùi bản mà không biết lùi về đâu.

## 🔗 Liên quan
- `09-observability-autofix.md` — kiến trúc đầu báo lỗi + hộp lỗi trung tâm (nền cho bài này).
- `17-toan-ven-tien.md` — chi tiết kỹ thuật để nhận diện & khoá đúng vùng tiền.
- `25-golive-ra-cua-hau-bypass.md` — cùng tinh thần "mặc định an toàn, không tin tên gọi/nhãn dán".
- `27-dung-de-ban-giao.md` — self-heal có lưới an toàn là 1 phần của "dựng để bàn giao được", vì người tiếp quản phải hiểu và tin được ranh giới tự động này.
