#!/bin/bash
# 📸 SNAPSHOT bộ nhớ — chụp 1 bản sao FIFO ra ngoài cây bộ nhớ (lớp 2 của 3-2-1).
# Chạy tay trước khi sửa mạnh, hoặc đặt lịch (cron/launchd) cho tự động.
#
# ⚙️ CONFIG:
ROOT="${MEMORY_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"   # thư mục bộ nhớ (cha của tools/)
DEST="${MEMORY_BACKUP_DIR:-$HOME/MemoryBackups}"           # nơi giữ snapshot
KEEP="${MEMORY_BACKUP_KEEP:-30}"                            # giữ bao nhiêu bản gần nhất
TAG="${1:-manual}"                                          # nhãn (tham số 1)

set -e
STAMP="$(date +%Y-%m-%d-%H%M%S)"
OUT="$DEST/$STAMP-$TAG"
mkdir -p "$OUT"

# Chỉ chép file thật (bỏ .git, rác hệ thống). Nếu trên iCloud, đảm bảo đã tải về trước.
rsync -a --exclude '.git' --exclude '.DS_Store' --exclude 'node_modules' --exclude '*.icloud' "$ROOT/" "$OUT/"
echo "✅ Snapshot: $OUT"

# Xoay vòng FIFO: giữ $KEEP bản mới nhất
cd "$DEST"
ls -1dt */ 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -rf
echo "   Giữ tối đa $KEEP bản trong $DEST"
