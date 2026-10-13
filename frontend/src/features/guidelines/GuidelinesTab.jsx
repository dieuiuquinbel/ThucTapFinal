import React from 'react';
import { BookOpen, CheckCircle2, Sparkles, Zap, MessageSquare } from 'lucide-react';

export default function GuidelinesTab() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/60">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-300/40">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-sky-950 flex items-center gap-2">
              Bí kíp & Nguyên tắc Nạp Bài học 🌟
            </h2>
            <p className="text-xs text-sky-700/80 font-medium">
              Một vài lưu ý nhỏ để bạn trợ lý đọc tài liệu nhanh nhất và trả lời chuẩn xác nhất nhé!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {/* 1. Định dạng hỗ trợ */}
          <div className="p-5 rounded-3xl bg-sky-50/60 border border-sky-200/80 space-y-2.5">
            <h3 className="font-black text-sky-950 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 1. Định dạng bài học hợp lệ
            </h3>
            <ul className="text-xs text-sky-900 space-y-2 pl-1 leading-relaxed font-medium">
              <li>• <strong>Sách PDF (.pdf):</strong> Giáo trình, slide bài giảng có chữ văn bản.</li>
              <li>• <strong>File Word (.docx):</strong> Văn bản Word phiên bản mới 2007 trở lên.</li>
              <li>• <strong>Ghi chú Text (.txt, .md):</strong> Văn bản thuần UTF-8 và ghi chú Markdown.</li>
              <li className="pt-1 text-amber-900 bg-amber-100/80 p-2.5 rounded-2xl border border-amber-200">
                💡 <strong>Mẹo với file .doc cũ:</strong> Hãy mở bằng Word rồi bấm <em>Save As</em> sang đuôi <strong>.docx</strong> trước khi cho vào Balo nhé!
              </li>
            </ul>
          </div>

          {/* 2. Quy định kích thước */}
          <div className="p-5 rounded-3xl bg-sky-50/60 border border-sky-200/80 space-y-2.5">
            <h3 className="font-black text-sky-950 text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" /> 2. Kích thước & dung lượng
            </h3>
            <ul className="text-xs text-sky-900 space-y-2 pl-1 leading-relaxed font-medium">
              <li>• <strong>Dung lượng tối đa:</strong> 50MB cho mỗi bài học nạp lên.</li>
              <li>• <strong>Khuyên dùng:</strong> Tệp dưới 20MB và dưới 150 trang để đọc siêu nhanh.</li>
              <li>• <strong>Phân chia đoạn học:</strong> Cắt từng đoạn thông minh kèm tiêu đề chương mục.</li>
              <li className="pt-1 text-sky-700 bg-white p-2.5 rounded-2xl border border-sky-200">
                ✨ Hạn chế dùng PDF scan ảnh chụp mờ để bạn trợ lý đọc chữ chính xác 100%.
              </li>
            </ul>
          </div>

          {/* 3. Cơ chế chạy ngầm & Cache */}
          <div className="p-5 rounded-3xl bg-sky-50/60 border border-sky-200/80 space-y-2.5">
            <h3 className="font-black text-sky-950 text-xs flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> 3. Siêu tốc độ với Bộ nhớ ngầm
            </h3>
            <ul className="text-xs text-sky-900 space-y-2 pl-1 leading-relaxed font-medium">
              <li>• <strong>100% Ngoại tuyến (Offline):</strong> Hoạt động trên card đồ họa máy bạn, không sợ mất mạng.</li>
              <li>• <strong>Tự soạn bài ngầm:</strong> Vừa nạp bài xong là hệ thống đã chuẩn bị sẵn câu hỏi và tóm tắt.</li>
              <li>• <strong>Xem kết quả tức thì (0.05s):</strong> Khi bạn bấm sang tab Quiz hay Tóm tắt, bài đã sẵn sàng!</li>
            </ul>
          </div>

          {/* 4. Mẹo hỏi bài */}
          <div className="p-5 rounded-3xl bg-sky-50/60 border border-sky-200/80 space-y-2.5">
            <h3 className="font-black text-sky-950 text-xs flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-sky-600" /> 4. Mẹo hỏi bài nhanh hiểu
            </h3>
            <ul className="text-xs text-sky-900 space-y-2 pl-1 leading-relaxed font-medium">
              <li>• <strong>Hỏi trọng tâm:</strong> "Định nghĩa của X là gì?", "So sánh A và B", "Liệt kê các bước...".</li>
              <li>• <strong>Chọn sách:</strong> Chọn đúng tên sách ở cột bên trái để câu trả lời bám sát nhất.</li>
              <li>• <strong>Hỏi bài mới:</strong> Bấm nút <em>+ Đặt câu hỏi mới</em> khi muốn chuyển sang bài học khác!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
