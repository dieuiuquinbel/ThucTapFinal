import React from 'react';
import { 
  RotateCcw, Sparkles, BookMarked, 
  ChevronUp, ChevronDown, RefreshCw, Send 
} from 'lucide-react';
import RichContentRenderer from '../../components/common/RichContentRenderer';

export default function ChatTab({
  messages,
  inputQuery,
  setInputQuery,
  chatLoading,
  selectedDocFilter,
  openSources,
  setOpenSources,
  chatBottomRef,
  onSendMessage,
  onNewChat
}) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 max-w-5xl mx-auto w-full">
      {/* Header thanh trạng thái */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-sky-100 shrink-0 bg-white/70 backdrop-blur-xs px-4 py-2 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
            💬 Trò chuyện: {messages.filter(m => m.role === 'user').length} câu hỏi
          </span>
          {selectedDocFilter !== 'Tất cả tài liệu' ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              📖 Đang xem: {selectedDocFilter}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              🌟 Xem tất cả tài liệu
            </span>
          )}
        </div>
        <button 
          onClick={onNewChat}
          className="text-xs font-bold text-sky-600 hover:text-sky-800 hover:bg-sky-50 px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1"
          title="Xóa đoạn chat để hỏi bài mới"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Hỏi bài mới
        </button>
      </div>

      {/* Vùng tin nhắn chat cuộn */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && (
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-sky-200 mt-1">
                <Sparkles className="w-5 h-5 text-yellow-200 fill-yellow-200" />
              </div>
            )}

            <div className={`max-w-2xl rounded-3xl p-4 sm:p-5 text-sm shadow-xs transition-all ${
              msg.role === 'user' 
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-br-xs shadow-sky-200/50' 
                : 'bg-white text-slate-800 border border-sky-100 rounded-bl-xs shadow-sky-100/40'
            }`}>
              {/* Nội dung tin nhắn */}
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</div>
              ) : (
                <RichContentRenderer text={msg.content} />
              )}

              {/* Hộp trích dẫn bài học - Phong cách thẻ kẹp sách Bookmark */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-sky-100">
                  <button 
                    onClick={() => setOpenSources(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className="flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50/80 hover:bg-sky-100 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                  >
                    <BookMarked className="w-4 h-4 text-sky-600" />
                    <span>Mở trang sách tham khảo ({msg.sources.length} vị trí)</span>
                    {openSources[idx] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {openSources[idx] && (
                    <div className="mt-2.5 space-y-2">
                      {msg.sources.map((src, sIdx) => (
                        <div key={sIdx} className="p-3 rounded-2xl bg-sky-50/50 border border-sky-200/80 text-xs text-slate-700 shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-sky-950 mb-1">
                            <span className="truncate max-w-[80%] flex items-center gap-1.5">
                              <span className="text-sky-600">📖</span> {src.source} • Trang {src.page} {src.heading ? `(${src.heading})` : ''}
                            </span>
                            <span className="text-[11px] font-bold text-sky-700 bg-white border border-sky-200 px-2 py-0.5 rounded-full shadow-2xs shrink-0">
                              Độ chuẩn: {(src.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="italic text-slate-600 text-[11px] leading-relaxed bg-white/80 p-2 rounded-xl border border-sky-100">
                            "{src.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Metadata Footer */}
              {Boolean(msg.latency) && (
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span className="text-sky-600/70 font-medium">✨ Bạn trợ lý giải đáp</span>
                  <span className="font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-md font-bold">⚡ {msg.latency}s</span>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-orange-200 mt-1">
                <span className="text-sm font-bold">Bạn</span>
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-9 h-9 rounded-2xl bg-sky-400 flex items-center justify-center text-white shrink-0 mt-1">
              <Sparkles className="w-5 h-5 text-yellow-200" />
            </div>
            <div className="bg-white border border-sky-200 rounded-3xl rounded-bl-xs p-4 text-xs font-bold text-sky-800 flex items-center gap-2.5 shadow-sm">
              <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
              <span>Đang lật các trang sách để soạn câu trả lời cho bạn nhé...</span>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Ô gõ câu hỏi */}
      <form onSubmit={onSendMessage} className="mt-4 shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Bạn muốn hỏi gì về bài học nào? (Ví dụ: 'Giải thích 3 bước bắt tay TCP nhé?')..."
            disabled={chatLoading}
            className="w-full bg-white border-2 border-sky-200 rounded-3xl py-4 pl-5 pr-14 text-sm text-sky-950 placeholder-sky-400/80 shadow-md shadow-sky-100/50 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all font-medium"
          />
          <button
            type="submit"
            disabled={chatLoading || !inputQuery.trim()}
            className="absolute right-2.5 p-2.5 bg-gradient-to-tr from-sky-500 to-blue-600 text-white rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all shadow-md shadow-sky-300/50 cursor-pointer"
            title="Gửi câu hỏi"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-sky-600/80 text-center mt-2 font-medium">
          💡 Trả lời 100% đúng theo nội dung tài liệu bạn đã nạp vào balo.
        </p>
      </form>
    </div>
  );
}
