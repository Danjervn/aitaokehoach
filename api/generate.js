module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' });
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function callGemini(prompt, maxOutputTokens = 6000) {
    const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const models = [...new Set([preferredModel, 'gemini-3.5-flash'])];
    let lastError = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
              },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens,
                  thinkingConfig: { thinkingLevel: 'low' }
                }
              })
            }
          );

          const raw = await response.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            throw new Error(`Gemini trả về dữ liệu không hợp lệ (HTTP ${response.status}): ${raw.slice(0, 180)}`);
          }

          if (!response.ok) {
            const message = data?.error?.message || `Gemini API error ${response.status}`;
            const retryable =
              response.status === 429 ||
              response.status === 503 ||
              /high demand|overload|temporar|capacity|resource exhausted/i.test(message);

            if (retryable && attempt === 0) {
              await sleep(1200);
              continue;
            }

            throw new Error(`[${model}] ${message}`);
          }

          const candidate = data.candidates?.[0];
          const text = (candidate?.content?.parts || [])
            .map(p => p.text || '')
            .join('\n')
            .trim();

          if (!text) throw new Error(`[${model}] AI không trả về nội dung.`);

          // Nếu một phần vẫn bị cắt, báo rõ thay vì âm thầm trả bộ đề thiếu.
          if (candidate?.finishReason === 'MAX_TOKENS') {
            throw new Error(`[${model}] Một phần nội dung vẫn bị cắt do giới hạn độ dài. Hãy thử lại.`);
          }

          return text;
        } catch (err) {
          lastError = err;
          const retryableText = /high demand|overload|temporar|capacity|429|503|resource exhausted/i.test(err.message || '');
          if (!retryableText) break;
        }
      }
    }

    throw lastError || new Error('Không thể gọi Gemini.');
  }

  try {
    const { level, grade, subject, examType, duration, topics, extra } = req.body || {};

    if (!subject || !topics) {
      return res.status(400).json({ error: 'Thiếu môn học hoặc phạm vi kiến thức.' });
    }

    const info = `
THÔNG TIN:
- Cấp: ${level || 'Không nêu'}
- Lớp: ${grade || 'Không nêu'}
- Môn: ${subject}
- Loại kiểm tra: ${examType || 'Không nêu'}
- Thời lượng: ${duration || 'Không nêu'}
- Phạm vi / yêu cầu cần đạt: ${topics}
- Yêu cầu thêm: ${extra || 'Không có'}
`.trim();

    const rules = `
QUY TẮC CHUNG:
1. Tổng điểm toàn bài chính xác 10,0.
2. Với môn phù hợp, tham chiếu cấu trúc: 7,0 điểm trắc nghiệm khách quan + 3,0 điểm tự luận.
3. Phần trắc nghiệm có thể gồm: nhiều lựa chọn 3,0 điểm; đúng/sai 2,0 điểm; trả lời ngắn 2,0 điểm. Nếu môn học không phù hợp, điều chỉnh hợp lý và ghi rõ.
4. Mục tiêu mức độ nhận thức: Nhận biết 40%, Thông hiểu 30%, Vận dụng 30% tính theo ĐIỂM.
5. Không tự bịa kiến thức ngoài phạm vi được cung cấp.
6. Mỗi câu trắc nghiệm phải có duy nhất MỘT đáp án đúng.
7. Không tạo câu hỏi mơ hồ do khác quy ước. Nếu dùng ℕ, phải nói rõ ℕ = {0, 1, 2, ...} hoặc dùng ℕ* = {1, 2, 3, ...}.
8. Tự kiểm tra lại phép tính điểm, số câu, đáp án và mức độ trước khi trả lời.
9. Không dùng placeholder kiểu "Câu hỏi 1...", "Nội dung A...". Phải viết câu hỏi thật.
10. Chỉ gọi đây là bộ đề "tham chiếu khung 7991", không khẳng định một cấu trúc duy nhất bắt buộc cho mọi môn/cấp.

QUY TẮC ĐỊNH DẠNG TOÁN HỌC:
- TUYỆT ĐỐI KHÔNG dùng LaTeX, MathJax hoặc ký tự $ bao công thức.
- Không dùng các lệnh \\frac, \\sqrt, \\forall, \\exists, \\in, \\mathbb, \\le, \\ge, \\overline.
- Dùng Unicode hiển thị trực tiếp: ∀, ∃, ∈, ℝ, ℕ, ≤, ≥, ², ³, √, ¬...
- Mọi công thức phải đọc được trực tiếp trong HTML và khi sao chép sang Word.
`.trim();

    // BƯỚC 1: Chỉ tạo khung/ma trận/đặc tả trước.
    const planPrompt = `
Bạn là chuyên gia thiết kế kiểm tra đánh giá trong giáo dục phổ thông Việt Nam.
Hãy lập KHUNG BỘ ĐỀ trước. Không viết toàn bộ câu hỏi ở bước này.

${info}

${rules}

ĐẦU RA BẮT BUỘC:
# BỘ ĐỀ KIỂM TRA ${subject.toUpperCase()}
Ghi ngắn gọn thông tin môn/lớp/thời gian.

## 1. Ma trận đề kiểm tra
Tạo bảng Markdown:
Chủ đề/đơn vị kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng điểm

Trong từng ô ghi rõ: dạng câu, số câu/câu số dự kiến và số điểm.
Có hàng tổng. Phải tự kiểm tra tổng đúng 10,0 điểm và gần đúng 40%/30%/30% theo điểm.

## 2. Bản đặc tả
Tạo bảng Markdown:
Chủ đề | Yêu cầu cần đạt | Mức độ | Dạng câu hỏi | Câu số | Số điểm

## KẾ HOẠCH CÂU HỎI
Cuối cùng ghi một danh sách cực rõ về số lượng câu và điểm của từng phần:
- A. Nhiều lựa chọn: ... câu, ... điểm/câu, tổng ... điểm
- B. Đúng/Sai: ... câu, cách tính điểm ..., tổng ... điểm
- C. Trả lời ngắn: ... câu, ... điểm/câu, tổng ... điểm
- D. Tự luận: ... câu, điểm từng câu, tổng ... điểm

Không viết câu hỏi chi tiết ở bước này.
`.trim();

    const plan = await callGemini(planPrompt, 4500);

    // BƯỚC 2: Viết nửa đầu đề.
    const examPart1Prompt = `
Bạn là chuyên gia ra đề. Dựa CHÍNH XÁC vào khung đã lập dưới đây để viết phần đầu của đề kiểm tra.

${info}

${rules}

KHUNG ĐÃ CHỐT:
--- BẮT ĐẦU KHUNG ---
${plan}
--- KẾT THÚC KHUNG ---

Chỉ xuất đúng hai mục sau, không lặp lại ma trận:

### A. Trắc nghiệm nhiều lựa chọn
- Viết ĐỦ số câu đã nêu trong khung.
- Mỗi câu có A, B, C, D.
- Gắn mức độ ngắn gọn sau số câu: (NB), (TH) hoặc (VD).
- Không ghi đáp án ở phần đề.

### B. Trắc nghiệm Đúng/Sai
- Viết ĐỦ số câu/ý đã nêu trong khung.
- Mỗi câu phải có dữ kiện rõ ràng và các ý a), b), c), d) nếu cấu trúc khung yêu cầu.
- Không ghi đáp án ở phần đề.

Không viết phần C, D và không viết đáp án.
`.trim();

    const examPart1 = await callGemini(examPart1Prompt, 5500);

    // BƯỚC 3: Viết nửa sau đề.
    const examPart2Prompt = `
Bạn là chuyên gia ra đề. Dựa CHÍNH XÁC vào khung đã lập để viết phần còn lại của đề kiểm tra.

${info}

${rules}

KHUNG ĐÃ CHỐT:
--- BẮT ĐẦU KHUNG ---
${plan}
--- KẾT THÚC KHUNG ---

Chỉ xuất đúng hai mục sau:

### C. Trả lời ngắn
- Viết ĐỦ số câu đã nêu trong khung.
- Câu hỏi phải có đáp án xác định được, không mơ hồ.
- Không ghi đáp án trong phần đề.

### D. Tự luận
- Viết ĐỦ số câu đã nêu trong khung.
- Mỗi câu có yêu cầu rõ, đủ dữ kiện, đúng mức độ trong ma trận.
- Không ghi lời giải/đáp án trong phần đề.

Không lặp lại phần A, B và không viết đáp án.
`.trim();

    const examPart2 = await callGemini(examPart2Prompt, 5000);

    const fullExam = `${examPart1}\n\n${examPart2}`;

    // BƯỚC 4: Đáp án + kiểm tra tính nhất quán.
    const answerPrompt = `
Bạn là chuyên gia chấm kiểm tra. Hãy tạo đáp án và hướng dẫn chấm CHÍNH XÁC cho đề bên dưới.

${info}

${rules}

KHUNG/MA TRẬN:
--- BẮT ĐẦU KHUNG ---
${plan}
--- KẾT THÚC KHUNG ---

ĐỀ KIỂM TRA:
--- BẮT ĐẦU ĐỀ ---
${fullExam}
--- KẾT THÚC ĐỀ ---

ĐẦU RA BẮT BUỘC:

## 4. Đáp án và hướng dẫn chấm
- Đáp án từng câu A, B, C, D.
- Với tự luận, nêu các bước/ý chính và điểm từng ý.
- Tổng điểm phải đúng 10,0.

## 5. Kiểm tra nhanh tính nhất quán
Lập bảng hoặc danh sách:
- Tổng điểm phần A
- Tổng điểm phần B
- Tổng điểm phần C
- Tổng điểm phần D
- Tổng cộng
- Điểm Nhận biết
- Điểm Thông hiểu
- Điểm Vận dụng
- Xác nhận số câu thực tế có đúng với ma trận không.
- Nếu phát hiện lệch nhỏ, ưu tiên hướng dẫn chấm theo đúng ma trận đã chốt và ghi rõ phần cần giáo viên rà soát.

Không viết lại toàn bộ đề.
`.trim();

    const answers = await callGemini(answerPrompt, 5500);

    const finalText =
      `${plan}\n\n` +
      `## 3. Đề kiểm tra\n\n` +
      `${examPart1}\n\n${examPart2}\n\n` +
      `${answers}`;

    return res.status(200).json({ text: finalText });
  } catch (e) {
    return res.status(500).json({
      error: e?.message || 'Lỗi không xác định'
    });
  }
};
