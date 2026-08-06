// Mẫu: Next.js server action TRẢ {ok,error} thay vì throw (prod che throw thành câu generic).
// + idempotent khi tạo 2 resource không cùng transaction. Đã rửa — thay <...> cho dự án bạn.

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; warning?: string | null }
  | { ok: false; error: string };

// ── Lỗi nghiệp vụ = TRẢ VỀ, không throw ──
export async function createRecord(input: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const name = String(input.get('name') ?? '').trim();
    if (!name) return { ok: false, error: 'Tên không được để trống' };
    const id = await db.insert(/* <table> */).values({ name }).returning('id');
    return { ok: true, data: { id } };
  } catch (e) {
    // throw CHỈ cho lỗi hệ thống bất ngờ; ở đây bắt để hiện câu thật cho người dùng.
    return { ok: false, error: e instanceof Error ? e.message : 'Có lỗi xảy ra' };
  }
}

// ── Idempotent: tạo auth user + profile (2 hệ, không cùng transaction) ──
// Lỗi giữa chừng để lại bản ghi mồ côi → nếu user đã tồn tại mà CHƯA có profile thì NHẬN LẠI.
export async function ensureUserWithProfile(email: string): Promise<ActionResult> {
  try {
    let userId: string;
    try {
      userId = await authProvider.createUser(email);
    } catch (e: any) {
      if (e?.code === 'USER_ALREADY_EXISTS') {
        const existing = await authProvider.getUserByEmail(email);
        if (existing.profileId) return { ok: false, error: 'Tài khoản đã tồn tại' }; // trùng thật
        userId = existing.id; // mồ côi → nhận lại
      } else throw e;
    }
    await db.insert(/* <profiles> */).values({ userId, email });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Có lỗi xảy ra' };
  }
}

// client:
//   const r = await createRecord(fd);
//   if (!r.ok) { toast.error(r.error); return; }
// Lấy lỗi THẬT khi throw lọt: tìm dòng "⨯ Error:" + digest trong server log (Railway/Vercel/stdout).
declare const db: any, authProvider: any, toast: any;
