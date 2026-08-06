// Mẫu: overlay/modal/drawer thoát "chứa-block" (ancestor có transform/filter/backdrop-filter)
// bằng React Portal ra document.body. Triệu chứng dính bẫy: overlay chỉ phủ 1 dải, không full màn.
import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // document chỉ có ở client → tránh lỗi SSR

  // đóng bằng phím Esc + khoá cuộn nền (tuỳ chọn)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-w-lg w-full rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body // ← thoát mọi ancestor có backdrop-blur/transform/filter
  );
}

// Phòng ngừa: ĐỪNG đặt overlay làm con của header/nav/section có
//   backdrop-blur | transform | filter | perspective | will-change:transform.
// Bắt nhanh trong DevTools: phần tử `fixed` có kích thước = ancestor thay vì = viewport.
