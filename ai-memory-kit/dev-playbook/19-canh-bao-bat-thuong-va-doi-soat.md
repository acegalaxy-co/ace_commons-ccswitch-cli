# 19 — Cảnh báo bất thường (rule-based) + đối soát dashboard

Bài này giải quyết gì: người non-tech không tự nhớ rà "thao tác sai / dữ liệu thiếu" → tiền, lương, số liệu lệch âm thầm; và khi dashboard đặt 2 số cạnh nhau mà phạm vi khác nhau, non-tech tưởng bị mất tiền. Cần một trung tâm tự soi rẻ (không cần AI) + quy tắc đối soát khi hiển thị.

## A) 🔔 Trung tâm cảnh báo bất thường — rule-based, rẻ, KHÔNG cần AI

**Ý tưởng:** hệ tự soi, gom về 1 chỗ, bấm-đi-sửa. Không cần model, chỉ cần một mảng rule mà mỗi rule là một phép đếm.

### Kiến trúc
- Một hàm `getAnomalies(tenantId)` trả về mảng rule. **Mỗi rule = 1 truy vấn `count()`** chạy song song, **khóa theo tenant + loại soft-deleted** (`isNull(deletedAt)`), trả `{ key, severity, title, count, desc, href, actionLabel }`, rồi **lọc `count > 0`**.
- Một hàm `getAnomalyTotal()` cho badge, **bọc try/catch** — badge KHÔNG được làm sập layout nếu 1 rule lỗi.
- Trang `/anomalies` gom theo mức **🔴 🟡 🔵** + nút "Đi xử lý" trỏ tới màn đã-lọc-sẵn.
- **Badge sidebar:** layout tính tổng số cảnh báo server-side (gộp vào `Promise.all` sẵn có) → truyền `alertCount` xuống Sidebar → badge đỏ trên mục "Cảnh báo".

```ts
type Rule = {
  key: string;
  severity: "critical" | "warn" | "info"; // 🔴 🟡 🔵
  title: string;
  count: number;
  desc: string;
  href: string;        // màn đã-lọc-sẵn để đi xử lý
  actionLabel: string;
};

async function getAnomalies(tenantId: string): Promise<Rule[]> {
  const results = await Promise.all(RULES.map((r) => r.run(tenantId)));
  return results.filter((r) => r.count > 0);
}

// badge KHÔNG được làm sập layout → bọc try/catch, lỗi thì trả 0
async function getAnomalyTotal(tenantId: string): Promise<number> {
  try {
    const rows = await getAnomalies(tenantId);
    return rows.reduce((s, r) => s + r.count, 0);
  } catch {
    return 0;
  }
}
```

Mỗi rule tự đóng gói truy vấn của nó, luôn khóa tenant và loại soft-deleted:

```ts
const RULES: { run: (t: string) => Promise<Rule> }[] = [
  {
    run: async (t) => {
      const [{ count }] = await db
        .select({ count: countFn() })
        .from(records)
        .where(and(eq(records.tenantId, t), isNull(records.deletedAt), /* điều kiện bất thường */));
      return { key: "unassigned_owner", severity: "warn", count,
        title: "Bản ghi chưa gán người chịu trách nhiệm",
        desc: "Có thể sai chia hoa hồng / lương.",
        href: "/records?filter=unassigned", actionLabel: "Đi xử lý" };
    },
  },
  // ...các rule khác
];
```

**Rule khởi điểm (ví dụ, suy ra cho ngành khác):** bản ghi chưa gán người-chịu-trách-nhiệm (sai chia tiền) · mặt hàng/dịch vụ chưa có giá vốn (lãi sai) · việc quá hạn chưa xử lý · yêu cầu quá SLA · lô hàng hết/sắp hết hạn · **tồn-kho-dưới-min** (tái dùng chính helper tính tồn = SUM sổ cái → số KHỚP trang Kho).

### 3 bài học (đắt tiền, đừng lặp)

1. **Cờ "dưới ngưỡng" PHẢI loại mặc-định-0.** Ngưỡng để mặc định `0` (min_qty / threshold) → điều kiện `value <= threshold` biến **MỌI bản ghi rỗng thành "dưới mức"** và báo đỏ rác. Ví dụ thực tế: gần như toàn bộ mặt hàng chưa-trữ báo đỏ, trong khi số thật chỉ vài món. **Sửa: chỉ tính khi `threshold > 0`** (nghĩa là "có theo dõi"). Sửa ở GỐC của cờ (1 nơi) để mọi trang dùng chung đều khớp; kiểm hành vi phụ thuộc (ví dụ auto-đặt-hàng) trước khi đổi.

2. **ĐO data thật trước khi tin con số trên UI.** Cảnh báo ngập rác = mất tác dụng (người dùng bỏ qua tất cả). Trước khi tin một rule, chạy truy vấn đếm trên data thật để biết nó ra bao nhiêu — nếu ra hàng trăm mà thực tế chỉ vài chục, rule đang sai chứ không phải data.

3. **Rule nhạy-thời-gian PHẢI có cửa sổ `RECENT_DAYS`.** Hệ thường bê data lịch sử từ tool cũ (thiếu trường). Nếu rule đếm CẢ lịch sử → cảnh báo ngập những bản ghi cũ nhiều năm KHÔNG sửa nổi. **Rule nhạy-thời-gian (giao dịch/lịch) → thêm cửa sổ `RECENT_DAYS` (vd 30)**; rule trạng-thái-hiện-tại (kho/lô) thì không cần. Ví dụ: "dịch vụ chưa giá vốn" → đổi thành "dịch vụ CÓ BÁN gần đây mà cost = 0" = đúng cái đang sinh tiền lúc này. Quá khứ vẫn nằm trong báo cáo, chỉ KHÔNG nhắc = coi như "ổn thoả". Trước khi hứa "tự sửa quá khứ": ĐO xem có suy được không (nếu 0 bản ghi có trường cần thiết → KHÔNG suy được → đừng hứa auto-fix).

```ts
const RECENT_DAYS = 30;
const since = new Date(Date.now() - RECENT_DAYS * 864e5);
// ...where(gte(records.createdAt, since))  // chỉ soi hoạt động gần đây
```

### Gate & mở rộng
- Rule đọc-only → để luôn-hiện được. Muốn gate thì thêm cờ tính-năng (mặc định bật).
- **Mở rộng:** một tầng AI chấm bất thường sâu (lệch số / nghi gian lận) chỉ **GỢI Ý**, người duyệt — nhưng đó là lớp phụ, rule-based ở trên đã bắt phần lớn cái đếm-được.

## B) 📊 Đối soát dashboard — bảng "chia theo X" cạnh "tổng" phải có dòng đối-soát

**Bài học:** đặt 2 số cạnh nhau mà **phạm vi khác nhau** (ví dụ "chia theo người" lọc hẹp hơn "tổng": bỏ bản ghi chưa-gán-người + bỏ khoản không-thuộc-ai như tiền cọc) → non-tech tưởng **MẤT TIỀN**. Mỗi bảng tính ĐÚNG nhưng trình bày gây hiểu lầm.

**Quy tắc:** bất kỳ bảng "chia nhỏ theo X" đặt cạnh một con số "tổng" → BẮT BUỘC thêm:
- dòng **"Chưa gán X"** (phần chưa thuộc nhóm nào),
- dòng các-khoản-không-thuộc-X (nếu có, ví dụ khoản chung),
- dòng **Tổng KHỚP** đúng bằng con số tổng ở chỗ khác.

Tính các dòng này từ số ĐÃ fetch, KHÔNG cần query mới:

```ts
const byX = groupSumByX(rows);                 // các nhóm đã gán X
const assigned = sum(byX.map((g) => g.amount));
const unassigned = grandTotal - assigned;      // "Chưa gán X"
// render byX + { label: "Chưa gán X", amount: unassigned }
//        + { label: "Tổng", amount: assigned + unassigned } === grandTotal
```

Đây là đối soát lúc **HIỂN THỊ** (khác với đối soát lúc IMPORT). Nguyên tắc chung: hễ một tổng bị chia nhỏ, phải luôn có đường để người xem cộng lại đúng bằng tổng gốc.

## 📋 Checklist
- [ ] Mảng rule, mỗi rule 1 `count()` khóa-tenant + loại soft-deleted, lọc `count > 0`
- [ ] Trang gom theo 🔴 🟡 🔵 + nút "Đi xử lý" tới màn đã-lọc + badge sidebar
- [ ] Hàm tổng cho badge **bọc try/catch** (1 rule lỗi không sập layout)
- [ ] Cờ "dưới ngưỡng" loại mặc-định-0 (`threshold > 0` mới tính)
- [ ] ĐO data thật trước khi tin con số rule ra
- [ ] Rule nhạy-thời-gian có cửa sổ `RECENT_DAYS`
- [ ] Mọi bảng "chia theo X" có dòng "Chưa gán X" + dòng Tổng-khớp

## ⚠️ Cạm bẫy
- Ngưỡng mặc định 0 → mọi bản ghi rỗng báo đỏ, cảnh báo thành rác.
- Tin số trên UI mà không đo data thật → rule sai không ai biết.
- Rule đếm cả data-migrate cũ → ngập cảnh báo lịch sử không sửa nổi.
- Bảng chia-theo-X không có dòng đối-soát → non-tech tưởng mất tiền.

## Liên quan
- `12-audit-log-undo-confirm.md` — nhật ký / hoàn tác quanh mọi thao tác đổi data.
- `20-chong-trung-va-xoa-day-chuyen.md` — chống trùng + xóa có dây chuyền.
- `09-observability-autofix.md` — hộp lỗi trung tâm + lằn ranh vùng-tiền cho AI tự-vá.
