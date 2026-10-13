import React from 'react';
import { Cpu } from 'lucide-react';

export default function ArchTab() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/60">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-300/40">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-sky-950 flex items-center gap-2">
              Bản đồ Bộ não AI SmartStudy 🧠
            </h2>
            <p className="text-xs text-sky-700/80 font-medium">
              Hệ thống hoạt động 100% trên máy tính cá nhân qua GPU NVIDIA, đảm bảo an toàn và bảo mật dữ liệu học tập.
            </p>
          </div>
        </div>

        {/* Architecture Flow Boxes */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/80 font-mono text-xs text-slate-700 leading-relaxed overflow-x-auto">
          <pre>{`
    [Người dùng / Sinh viên]
               │
               ▼
    [REACT + TAILWIND CSS (Frontend)]
               │
               ▼ REST API
    [FASTAPI (Backend Orchestrator)]
         ┌──────┴──────┐
         ▼             ▼
   [Upload PDF]   [Truy vấn câu hỏi / Quiz]
         │             │
         ▼             ▼
   [PyMuPDF Chunks] [ChromaDB Vector Store] (Cosine Top-k)
         │             │
         └──────┬──────┘
                ▼ (Gộp Context + Prompt Tiếng Việt)
   [LOCAL LLM (Ollama - Qwen 2.5 7B / Dự phòng: Qwen 2.5 3B)]
                │
                ▼
   1. Trả lời câu hỏi kèm trích dẫn số trang chính xác
   2. Tự động sinh trắc nghiệm A-B-C-D (JSON mode)
   3. Tóm tắt nội dung bài giảng
          `}</pre>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/50">
        <h3 className="font-black text-sky-950 text-sm mb-4 flex items-center gap-2">
          <span>⚙️</span> Cấu hình Thiết bị & Bạn Trợ lý
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80">
            <span className="text-sky-700 block mb-1 font-bold">Mô hình AI chính</span>
            <span className="font-extrabold text-sky-950 text-sm">Qwen 2.5 7B (Ollama)</span>
            <p className="text-sky-600 mt-1 font-medium">Hiểu tiếng Việt chuẩn xác, giải thích bài học siêu dễ hiểu.</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
            <span className="text-amber-700 block mb-1 font-bold">Mô hình AI dự phòng</span>
            <span className="font-extrabold text-amber-950 text-sm">Qwen 2.5 3B (Ollama)</span>
            <p className="text-amber-700 mt-1 font-medium">Siêu nhẹ (~1.9GB), phản hồi tức thì, không gây tràn VRAM.</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
            <span className="text-emerald-700 block mb-1 font-bold">Bộ nhớ ngữ nghĩa</span>
            <span className="font-extrabold text-emerald-950 text-sm">BGE-M3 + BM25 + FlashRank</span>
            <p className="text-emerald-700 mt-1 font-medium">Tìm đúng trang sách chỉ trong 0.02 giây.</p>
          </div>
          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80">
            <span className="text-purple-700 block mb-1 font-bold">Tủ sách lưu trữ</span>
            <span className="font-extrabold text-purple-950 text-sm">ChromaDB Cục bộ</span>
            <p className="text-purple-700 mt-1 font-medium">Lưu trữ bảo mật trong thư mục \`./chroma_db\`.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
