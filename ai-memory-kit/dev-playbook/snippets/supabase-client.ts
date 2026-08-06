// Mẫu: Supabase client KHÔNG rò RAM (server: singleton + autoRefreshToken:false).
// Mỗi createClient() với autoRefreshToken (mặc định BẬT) để lại ~11KB không thu hồi trên server
// → traffic cao + chạy lâu = phình tới GB. Nguyên tắc gốc: tài nguyên nặng KHỞI TẠO 1 LẦN.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 1) Public client (server lẫn client, không session) — tắt refresh + không lưu session.
export const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 2) Admin/service client — SINGLETON, CHỈ server. Service key không hết hạn → không cần refresh.
let _admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  return (_admin ??= createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

// 3) Client per-request user-scope (cần token/cookie từng user) → KHÔNG singleton được,
//    nhưng VẪN bắt buộc autoRefreshToken:false.
// ── Ngoại lệ GIỮ autoRefreshToken:true: browser client đăng nhập thật ('use client',
//    persistSession:true) — 1 tab = 1 client, không leak; tắt ở đây = vỡ đăng nhập.
//    Dùng @supabase/ssr (createServerClient/createBrowserClient) đã tự tắt sẵn bên trong.
// ⚠️ Bẫy TS: dùng `type SupabaseClient` import; ĐỪNG `let x: ReturnType<typeof createClient>`
//    (mất generic → kiểu thành `never` → vỡ build).
