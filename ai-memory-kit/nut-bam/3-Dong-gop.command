#!/bin/bash
# Nhấp đúp để ĐÓNG GÓP NGƯỢC cải tiến phần KHUNG của bạn cho maintainer (tự quét rò, không gói dữ liệu riêng).
cd "$(dirname "$0")/.." || exit 1
echo "🔁 ĐÓNG GÓP NGƯỢC"
read -r -p "Mô tả ngắn đề xuất của bạn (vd: thêm nguyên tắc X): " d
read -r -p "Tên công ty/bạn để quét rò chặn (cách nhau dấu phẩy, có thể bỏ trống): " b
if [ -n "$b" ]; then node tools/dong-gop.mjs "$d" --block "$b"; else node tools/dong-gop.mjs "$d"; fi
echo
read -r -p "Xong. Nhấn Enter để đóng cửa sổ này."
