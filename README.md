# EduAI 7991

Web MVP tạo bộ đề kiểm tra bằng Gemini AI, gồm: ma trận, bản đặc tả, đề kiểm tra, đáp án và hướng dẫn chấm.

## Cách triển khai nhanh trên Vercel

1. Tạo Gemini API key tại Google AI Studio.
2. Đưa thư mục dự án lên GitHub hoặc import vào Vercel bằng cách bạn quen dùng.
3. Trong Vercel > Project > Settings > Environment Variables, tạo:
   - Name: `GEMINI_API_KEY`
   - Value: API key của bạn
4. Deploy lại project.
5. Mở link Vercel và thử tạo một đề.

## Lưu ý
- API key chỉ nằm trên server, không nhúng trong trình duyệt.
- Nội dung AI cần giáo viên rà soát trước khi dùng.
- Công cụ gọi sản phẩm là "tham chiếu khung 7991" để tránh khẳng định phạm vi áp dụng pháp lý quá mức.
