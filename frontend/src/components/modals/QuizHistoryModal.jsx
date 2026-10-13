import React from 'react';

export default function QuizHistoryModal({
  isOpen,
  onClose,
  currentUser,
  quizHistoryList
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-sky-100 relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-5 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl shadow-xs">
            🏆
          </div>
          <div>
            <h2 className="text-lg font-black text-sky-950 flex items-center gap-2">
              Bảng Lịch Sử Điểm & Đánh Giá Năng Lực
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Học viên: <strong className="text-sky-900">{currentUser?.full_name}</strong> • Tổng số lần thi: {quizHistoryList?.length || 0} bài
            </p>
          </div>
        </div>

        {/* Danh sách kết quả thi */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {(!quizHistoryList || quizHistoryList.length === 0) ? (
            <div className="p-8 text-center bg-sky-50/50 rounded-2xl border border-sky-100">
              <p className="text-sm font-bold text-sky-900">Bạn chưa có bài thi trắc nghiệm nào!</p>
              <p className="text-xs text-slate-500 mt-1">Hãy vào tab "Đấu trường Quiz", làm bài kiểm tra và nộp bài để tích lũy điểm nhé!</p>
            </div>
          ) : (
            quizHistoryList.map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between hover:bg-sky-50/60 transition-colors">
                <div className="truncate mr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                      {item.difficulty || 'Tiêu chuẩn'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(item.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p className="font-bold text-xs text-slate-900 truncate" title={item.document_source}>
                    📖 {item.document_source}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đúng {item.correct_count} / {item.total_questions} câu
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-xl font-black ${
                    item.score_10 >= 8.0 ? 'text-emerald-600' :
                    item.score_10 >= 5.0 ? 'text-sky-600' : 'text-rose-600'
                  }`}>
                    {item.score_10}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">/10</span>
                  <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                    {item.score_10 >= 8.0 ? 'Xuất sắc 🌟' : item.score_10 >= 5.0 ? 'Đạt yêu cầu ✨' : 'Cần cố gắng 💭'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 mt-2 border-t border-slate-100 shrink-0 text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Đóng bảng điểm
          </button>
        </div>
      </div>
    </div>
  );
}
