import React from 'react';
import { Layers, RefreshCw, Sparkles, RotateCcw } from 'lucide-react';

export default function FlashcardsTab({
  fcDoc,
  setFcDoc,
  numCards,
  setNumCards,
  flashcards,
  setFlashcards,
  flippedCards,
  setFlippedCards,
  fcLoading,
  documents,
  onGenerateFlashcards
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
      <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/60 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-300/40">
            <Layers className="w-5 h-5 text-emerald-100" />
          </div>
          <div>
            <h2 className="text-lg font-black text-sky-950 flex items-center gap-2">
              Thẻ Ghi Nhớ Học Nhanh 🎴
            </h2>
            <p className="text-xs text-sky-700/80 font-medium">
              Học thuộc các định nghĩa, thuật ngữ cốt lõi siêu tốc trước giờ vào phòng thi.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-4">
          <div>
            <label className="text-[11px] font-bold text-sky-900 block mb-1">📖 Chọn bài học</label>
            <select 
              value={fcDoc} 
              onChange={(e) => {
                const newDoc = e.target.value;
                setFcDoc(newDoc);
                try { localStorage.setItem('smartstudy_fc_doc', newDoc); } catch (_) {}
                setFlashcards(null);
                setFlippedCards({});
              }}
              className="w-full text-xs font-semibold bg-sky-50/50 border border-sky-200 rounded-2xl p-3 text-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {documents.map((d, i) => (
                <option key={i} value={d.source}>📄 {d.source}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-sky-900 block mb-1">🃏 Số lượng thẻ ôn tập</label>
            <select 
              value={numCards} 
              onChange={(e) => setNumCards(e.target.value)}
              className="w-full text-xs font-semibold bg-sky-50/50 border border-sky-200 rounded-2xl p-3 text-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value={4}>4 thẻ (Khởi động)</option>
              <option value={6}>6 thẻ (Tiêu chuẩn)</option>
              <option value={8}>8 thẻ (Chuyên sâu)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => onGenerateFlashcards(fcDoc)}
          disabled={fcLoading || documents.length === 0}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-emerald-200 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          {fcLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {fcLoading ? 'Đang trích xuất khái niệm cho bạn...' : '✨ Tạo bộ Thẻ ghi nhớ thông minh'}
        </button>
      </div>

      {flashcards && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flashcards.map((card, idx) => {
            const isFlipped = flippedCards[idx];
            return (
              <div 
                key={idx} 
                onClick={() => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))}
                className={`p-6 rounded-3xl border-2 cursor-pointer transition-all min-h-[175px] flex flex-col justify-between shadow-sm card-hover ${
                  isFlipped 
                    ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-white border-emerald-300 shadow-emerald-100' 
                    : 'bg-white border-sky-200/80 hover:border-sky-400 shadow-sky-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-black mb-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full border ${
                      isFlipped ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-sky-100 text-sky-800 border-sky-200'
                    }`}>
                      Thẻ #{idx + 1} • {card.category || 'Khái niệm quan trọng'}
                    </span>
                    <span className="text-sky-500 font-bold flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Lật thẻ
                    </span>
                  </div>
                  <p className="font-extrabold text-sky-950 text-base leading-snug mb-2">
                    {card.front || card.term || card.question || card.concept || card.title || 'Khái niệm quan trọng'}
                  </p>
                  {isFlipped && (
                    <div className="mt-3 pt-3 border-t border-emerald-200/80 text-xs text-slate-700 leading-relaxed font-medium bg-white/70 p-3 rounded-2xl">
                      {card.back || card.definition || card.answer || card.explanation || card.meaning || 'Chưa có định nghĩa'}
                    </div>
                  )}
                </div>
                <div className="text-[11px] font-bold mt-3 flex items-center justify-between">
                  <span className={isFlipped ? 'text-emerald-700' : 'text-sky-600'}>
                    {isFlipped ? '✅ Đã xem giải thích' : '👆 Chạm vào thẻ để xem đáp án'}
                  </span>
                  <span className="text-amber-500">⭐ Ôn bài</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
