module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' });

  try {
    const { level, grade, subject, examType, duration, topics, extra } = req.body || {};
    if (!subject || !topics) return res.status(400).json({ error: 'Thiếu môn học hoặc phạm vi kiến thức.' });

    const prompt = `Bạn là chuyên gia thiết kế kiểm tra đánh giá trong giáo dục phổ thông Việt Nam.
Hãy tạo MỘT BỘ HỒ SƠ KIỂM TRA hoàn chỉnh, thực tế, bằng tiếng Việt, cho giáo viên sử dụng và chỉnh sửa.

THÔNG TIN:
- Cấp: ${level}
- Lớp: ${grade}
- Môn: ${subject}
- Loại kiểm tra: ${examType}
- Thời lượng: ${duration}
- Phạm vi / yêu cầu cần đạt: ${topics}
- Yêu cầu thêm: ${extra || 'Không có'}

YÊU CẦU THAM CHIẾU CÔNG VĂN 7991/BGDĐT-GDTrH:
1. Tổng điểm 10,0.
2. Với môn phù hợp, bố trí 7,0 điểm trắc nghiệm khách quan và 3,0 điểm tự luận.
3. Phần trắc nghiệm gồm: nhiều lựa chọn 3,0 điểm; đúng-sai 2,0 điểm; trả lời ngắn 2,0 điểm. Nếu đặc thù môn học không phù hợp một dạng, hãy ghi rõ điều chỉnh hợp lý thay vì cố ép.
4. Phân bố mức độ nhận thức mục tiêu: Nhận biết 40%, Thông hiểu 30%, Vận dụng 30% theo tổng điểm.
5. 70/30 ở trên là TỈ LỆ ĐIỂM, không phải tỉ lệ số câu.
6. Không tự bịa kiến thức ngoài phạm vi người dùng cung cấp. Nếu đầu vào thiếu, dùng kiến thức phổ thông an toàn và ghi chú giáo viên cần đối chiếu SGK/chương trình đang dạy.
7. Không khẳng định Công văn 7991 bắt buộc áp dụng giống nhau cho mọi cấp/địa phương; gọi đây là bộ đề "tham chiếu khung 7991".

QUY TẮC ĐỊNH DẠNG TOÁN HỌC:
- TUYỆT ĐỐI KHÔNG sử dụng LaTeX hoặc MathJax.
- Không dùng ký tự $ để bao công thức.
- Không xuất các lệnh như \\frac, \\sqrt, \\forall, \\exists, \\in, \\mathbb, \\le, \\ge, \\overline.
- Dùng ký hiệu Unicode có thể hiển thị trực tiếp trong HTML.
- Ví dụ:
  + ∀ thay cho \\forall
  + ∃ thay cho \\exists
  + ∈ thay cho \\in
  + ℝ thay cho \\mathbb{R}
  + ℕ thay cho \\mathbb{N}
  + ≤ thay cho \\le
  + ≥ thay cho \\ge
  + x² thay cho x^2
  + x³ thay cho x^3
  + √x thay cho \\sqrt{x}
  + ¬P thay cho \\overline{P}
- Mọi công thức phải đọc được trực tiếp như văn bản thuần trong trình duyệt.

QUY TẮC CHỐNG MƠ HỒ:
- Mỗi câu trắc nghiệm phải có DUY NHẤT một đáp án đúng.
- Tránh câu hỏi có đáp án phụ thuộc vào quy ước khác nhau giữa sách/tài liệu.
- Nếu dùng ℕ, phải nói rõ ℕ = {0, 1, 2, ...} hoặc dùng ℕ* = {1, 2, 3, ...} khi cần.
- Với ký hiệu, thuật ngữ hoặc quy ước có thể có nhiều cách hiểu, phải nêu rõ quy ước ngay trong câu hỏi.
- Tự kiểm tra lại đáp án trước khi trả về; nếu có hơn một đáp án hợp lý thì phải sửa câu hỏi.

ĐẦU RA BẮT BUỘC, dùng Markdown rõ ràng:
# BỘ ĐỀ KIỂM TRA ...
Thông tin môn/lớp/thời gian.

## 1. Ma trận đề kiểm tra
Tạo bảng gồm: Chủ đề/đơn vị kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng điểm. Trong mỗi ô ghi dạng câu/số câu hoặc câu số mấy và số điểm. Có hàng tổng kiểm tra đúng 10 điểm và đúng tỉ lệ 40/30/30.

## 2. Bản đặc tả
Tạo bảng: Chủ đề | Yêu cầu cần đạt | Mức độ | Dạng câu hỏi | Câu số | Số điểm.

## 3. Đề kiểm tra
Chia rõ:
### A. Trắc nghiệm nhiều lựa chọn
### B. Trắc nghiệm Đúng/Sai
### C. Trả lời ngắn
### D. Tự luận
Mỗi câu phải có nội dung thật, không dùng placeholder. Câu hỏi phải phù hợp môn ${subject}, lớp ${grade}.

## 4. Đáp án và hướng dẫn chấm
Có đáp án từng câu và điểm cụ thể, tổng đúng 10 điểm.

## 5. Kiểm tra nhanh tính nhất quán
Liệt kê tổng điểm từng phần, tổng điểm theo mức độ và xác nhận có khớp ma trận hay không. Nếu không khớp thì tự sửa trước khi trả lời.

Ưu tiên chất lượng thực dụng, tránh giải thích dài dòng về lý thuyết. Chỉ trả về bộ hồ sơ hoàn chỉnh.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8000,
          thinkingConfig: { thinkingLevel: 'low' }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini API error');
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
    if (!text) throw new Error('AI không trả về nội dung.');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Lỗi không xác định' });
  }
};
