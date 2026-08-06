-- rls-checklist.sql — BẬT RLS đúng cách trên Supabase/Postgres + audit.
-- LÝ DO: Supabase tự phơi REST API với anon key CÔNG KHAI. Không RLS = ai cũng đọc/ghi.

-- 1) Bật RLS cho 1 bảng (deny-default: không policy = không ai qua anon key)
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

-- 2) Ví dụ policy: chỉ đọc bản ghi "công khai", chỉ chủ sở hữu sửa
DROP POLICY IF EXISTS <table>_public_read ON public.<table>;
CREATE POLICY <table>_public_read ON public.<table>
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS <table>_owner_write ON public.<table>;
CREATE POLICY <table>_owner_write ON public.<table>
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 3) App SERVER dùng service_role (BYPASS RLS) cho thao tác hệ thống.
--    ⚠️ service_role TUYỆT ĐỐI không lộ ra client. Client chỉ dùng anon key.

-- 4) AUDIT — liệt kê bảng public CHƯA bật RLS (kết quả phải RỖNG):
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false
ORDER BY tablename;

-- 5) (tuỳ) Liệt kê bảng đã bật RLS nhưng KHÔNG có policy nào (=> khoá sạch, có thể ngoài ý muốn):
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public' AND t.rowsecurity = true AND p.policyname IS NULL
GROUP BY t.tablename;
