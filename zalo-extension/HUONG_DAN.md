# OME Zalo AI Helper v1.1 - Chrome Extension

## Cài đặt (1 lần duy nhất - mọi máy trong team)

1. Mở Chrome → vào địa chỉ: `chrome://extensions`
2. Bật **Developer mode** (góc trên phải)
3. Nhấn **Load unpacked** → chọn thư mục `zalo-extension`
4. Mở `chat.zalo.me` → nhấn nút **🤖 AI** bên phải màn hình
5. Nhấn ⚙ → nhập **URL GAS** (lấy từ app teamduyen) → **Lưu**

## Admin cài Gemini Key (1 lần duy nhất cho cả team)

1. Mở Extension → nhấn ⚙
2. Tick chọn **Admin**
3. Dán **Gemini API Key** vào ô xuất hiện (lấy tại https://aistudio.google.com/app/apikey)
4. Nhấn **Lưu** → key được gửi lên Google Sheets (Settings sheet)
5. Xong! Nhân viên khác không cần nhập key

## Sử dụng hàng ngày

1. Mở chat với khách trên Zalo
2. Extension tự động phát hiện SĐT (nếu tên có số) → tra cứu ngay
3. Xem lịch sử đơn + tình trạng CS
4. Dán tin nhắn khách → chọn giọng → **✨ Tạo gợi ý AI**
5. Click gợi ý → copy → paste vào Zalo
6. Cập nhật tình trạng CS → **💾 Lưu về GSheet** → app teamduyen thấy ngay sau Sync

## Kết nối thường gặp

- **Không tìm thấy khách**: Sync GS trên app teamduyen trước
- **Lỗi Admin chưa cài Gemini Key**: Admin thực hiện bước “Admin cài key” ở trên
- **SĐT không tự phát hiện**: Nhập tay số vào ô → Tra cứu

## Gemini Free tier: 15 yêu cầu/phút, 1M token/ngày — 5 người dùng bình thường thừa dùng
