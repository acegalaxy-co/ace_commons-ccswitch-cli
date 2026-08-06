-- sql-idempotent.sql — khung SQL AN TOÀN cho Postgres/Supabase.
-- Nguyên tắc: chạy lại nhiều lần KHÔNG lỗi (idempotent) · cả file 1 transaction · reload schema sau DDL.
-- Thay <table>/<col>/<policy> cho dự án của bạn.

BEGIN;  -- cả file 1 giao dịch: 1 lỗi → rollback hết, không để DB nửa vời

-- Bảng
CREATE TABLE IF NOT EXISTS public.<table> (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Thêm cột (an toàn khi chạy lại)
ALTER TABLE public.<table> ADD COLUMN IF NOT EXISTS <col> text;

-- Index
CREATE INDEX IF NOT EXISTS <table>_<col>_idx ON public.<table> (<col>);

-- Bật RLS (xem rls-checklist.sql)
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

-- Policy: DROP IF EXISTS trước rồi CREATE (vì CREATE POLICY không có IF NOT EXISTS)
DROP POLICY IF EXISTS <policy>_read ON public.<table>;
CREATE POLICY <policy>_read ON public.<table>
  FOR SELECT USING (true);   -- ⚠️ sửa điều kiện cho đúng quyền của bạn

COMMIT;

-- Sau DDL: PostgREST cache schema → phải reload, kẻo API báo "column/relation does not exist"
NOTIFY pgrst, 'reload schema';
