#!/bin/bash
# Nhấp đúp để KHÁM + DỌN tủ bộ nhớ (chạy bác sĩ). Mac: nếu báo "unidentified developer" → chuột phải > Open.
cd "$(dirname "$0")/.." || exit 1
echo "🩺 Đang khám tủ bộ nhớ…"; echo
node tools/memory-doctor.mjs --fix
echo
read -r -p "Xong. Nhấn Enter để đóng cửa sổ này."
