#!/bin/bash
# Nhấp đúp để NÂNG CẤP một tủ bộ nhớ đã cài (cũ) lên bản kit MỚI này. Giữ nguyên dữ liệu của bạn.
cd "$(dirname "$0")/.." || exit 1
echo "🔼 NÂNG CẤP tủ bộ nhớ"
echo "Dán đường dẫn THƯ MỤC BỘ NHỚ của bạn rồi Enter (vd: ~/MyMemory)."
read -r -p "Đường dẫn: " p
[ -z "$p" ] && { echo "Bỏ trống → huỷ."; read -r -p "Enter để đóng."; exit 0; }
node tools/nang-cap.mjs "$p"
echo
read -r -p "Xong. Nhấn Enter để đóng cửa sổ này."
