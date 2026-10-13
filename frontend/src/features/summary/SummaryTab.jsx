import React from 'react';
import { FileText, RefreshCw, Sparkles, Download } from 'lucide-react';
import RichContentRenderer from '../../components/common/RichContentRenderer';

export default function SummaryTab({
  sumDoc,
  setSumDoc,
  sumStyle,
  setSumStyle,
  summaryResult,
  setSummaryResult,
  sumLoading,
  documents,
  onGenerateSummary
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
      <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/60 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-400 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-300/40">
            <FileText className="w-5 h-5 text-purple-100" />
          </div>
          <div>
            <h2 className="text-lg font-black text-sky-950 flex items-center gap-2">
              Sổ tay Tóm tắt Kiến thức 📑
            </h2>
            <p className="text-xs text-sky-700/80 font-medium">
              Tự động cô đọng bài giảng thành đề cương ôn tập có cấu trúc gạch đầu dòng rõ ràng.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-4">
          <div>
            <label className="text-[11px] font-bold text-sky-900 block mb-1">📖 Chọn bài học cần tóm tắt</label>
            <select 
              value={sumDoc} 
              onChange={(e) => {
                const newDoc = e.target.value;
                setSumDoc(newDoc);
                try { localStorage.setItem('smartstudy_sum_doc', newDoc); } catch (_) {}
                setSummaryResult(null);
                if (newDoc) {
                  onGenerateSummary(sumStyle, newDoc);
                }
              }}
              className="w-full text-xs font-semibold bg-sky-50/50 border border-sky-200 rounded-2xl p-3 text-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {documents.map((d, i) => (
                <option key={i} value={d.source}>📄 {d.source}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-sky-900 block mb-1.5">🎯 Mức độ chi tiết</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Cơ bản', label: '⚡ Nhanh', desc: 'Đọc trong 30s' },
                { id: 'Trung bình', label: '📘 Vừa đủ', desc: 'Đề cương ôn tập' },
                { id: 'Nâng cao', label: '🎓 Chi tiết', desc: 'Đầy đủ ý chính' }
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => {
                    setSumStyle(lvl.id);
                    try { localStorage.setItem('smartstudy_sum_style', lvl.id); } catch (_) {}
                    if (sumDoc) {
                      onGenerateSummary(lvl.id, sumDoc);
                    }
                  }}
                  className={`p-2.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    sumStyle === lvl.id
                      ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold shadow-sm ring-2 ring-purple-200'
                      : 'bg-white border-slate-200/80 text-slate-600 hover:border-purple-200 hover:bg-purple-50/40'
                  }`}
                >
                  <div className="text-xs font-bold">{lvl.label}</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">{lvl.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => onGenerateSummary(sumStyle, sumDoc)}
          disabled={sumLoading || documents.length === 0}
          className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-purple-200 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          {sumLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {sumLoading ? 'Đang đọc và tóm gọn bài học cho bạn...' : `✨ Soạn đề cương tóm tắt (${sumStyle})`}
        </button>
      </div>

      {summaryResult && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/50">
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-sky-100">
            <div>
              <h3 className="font-black text-sky-950 text-base flex items-center gap-2">
                <span>📖</span> Đề Cương Tóm Tắt: {summaryResult.document_title || sumDoc}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-sky-600 font-medium">⚡ Thời gian: {summaryResult.latency_sec}s</p>
                {summaryResult.from_cache && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    ⚡ Tức thì từ Bộ nhớ
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => {
                const blob = new Blob([summaryResult.text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `TomTat_${sumDoc}.txt`;
                link.click();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border-2 border-sky-200 text-xs font-bold text-sky-900 hover:bg-sky-50 shadow-2xs cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" /> Lưu về (.txt)
            </button>
          </div>
          <div className="text-sm text-slate-800 leading-relaxed font-sans pt-1">
            <RichContentRenderer text={summaryResult.text} />
          </div>
        </div>
      )}
    </div>
  );
}
