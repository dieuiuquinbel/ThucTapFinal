import React from 'react';
import { 
  Trophy, RefreshCw, Zap, ArrowLeft, ArrowRight, 
  RotateCcw, CheckCircle2, XCircle 
} from 'lucide-react';

export default function QuizTab({
  quizDoc,
  setQuizDoc,
  numQuestions,
  setNumQuestions,
  quizDifficulty,
  setQuizDifficulty,
  quizData,
  setQuizData,
  quizMeta,
  setQuizMeta,
  currentQuestionIdx,
  setCurrentQuestionIdx,
  userAnswers,
  setUserAnswers,
  quizSubmitted,
  setQuizSubmitted,
  quizLoading,
  documents,
  onGenerateQuiz,
  onSubmitWithSave,
  calculateScore
}) {
  const score = calculateScore();

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
      {/* Hộp cấu hình Đấu trường Quiz */}
      <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/60 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-28 h-28 bg-amber-100/50 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-300/40">
            <Trophy className="w-5 h-5 text-yellow-100 fill-yellow-100" />
          </div>
          <div>
            <h2 className="text-lg font-black text-sky-950 flex items-center gap-2">
              Đấu trường Thử thách Quiz 🏆
            </h2>
            <p className="text-xs text-sky-700/80 font-medium">
              Tự động tạo câu hỏi trắc nghiệm 4 đáp án A-B-C-D kèm lời giải chi tiết cho từng bài học.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-4">
          <div>
            <label className="text-[11px] font-bold text-sky-900 block mb-1">📖 Chọn bài học cần thi</label>
            <select 
              value={quizDoc} 
              onChange={(e) => {
                const newDoc = e.target.value;
                setQuizDoc(newDoc);
                try { localStorage.setItem('smartstudy_quiz_doc', newDoc); } catch (_) {}
                setQuizData(null);
                setQuizMeta(null);
                if (newDoc) {
                  onGenerateQuiz(quizDifficulty, newDoc, Number(numQuestions));
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
            <label className="text-[11px] font-bold text-sky-900 block mb-1">🎯 Số lượng câu hỏi</label>
            <select 
              value={numQuestions} 
              onChange={(e) => {
                const count = Number(e.target.value);
                setNumQuestions(count);
                try { localStorage.setItem('smartstudy_quiz_count', count); } catch (_) {}
                if (quizDoc) {
                  onGenerateQuiz(quizDifficulty, quizDoc, count);
                }
              }}
              className="w-full text-xs font-semibold bg-sky-50/50 border border-sky-200 rounded-2xl p-3 text-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value={5}>🌱 5 câu (Khởi động nhanh)</option>
              <option value={10}>⚡ 10 câu (Luyện tập tiêu chuẩn)</option>
              <option value={15}>🔥 15 câu (Thử thách mở rộng)</option>
            </select>
          </div>
        </div>

        {/* 3 Thẻ độ khó phong cách Huy hiệu EdTech */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-sky-900 block mb-2">⭐ Chọn cấp độ thử thách</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'Dễ', label: 'Khởi động 🌱', desc: 'Định nghĩa & Khái niệm', active: 'border-emerald-400 bg-emerald-50 text-emerald-950 shadow-emerald-100 ring-2 ring-emerald-300' },
              { id: 'Trung bình', label: 'Tăng tốc ⚡', desc: 'Thông hiểu & Phân tích', active: 'border-sky-400 bg-sky-50 text-sky-950 shadow-sky-100 ring-2 ring-sky-300' },
              { id: 'Khó', label: 'Chinh phục 🏆', desc: 'Vận dụng nâng cao', active: 'border-rose-400 bg-rose-50 text-rose-950 shadow-rose-100 ring-2 ring-rose-300' }
            ].map((diff) => (
              <button
                key={diff.id}
                type="button"
                onClick={() => {
                  setQuizDifficulty(diff.id);
                  try { localStorage.setItem('smartstudy_quiz_diff', diff.id); } catch (_) {}
                  if (quizDoc) {
                    onGenerateQuiz(diff.id, quizDoc, Number(numQuestions));
                  }
                }}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  quizDifficulty === diff.id
                    ? `${diff.active} shadow-md`
                    : 'bg-white border-slate-200/80 text-slate-600 hover:border-sky-200 hover:bg-sky-50/40'
                }`}
              >
                <div className="text-xs font-black">{diff.label}</div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">{diff.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onGenerateQuiz(quizDifficulty, quizDoc, Number(numQuestions))}
          disabled={quizLoading || documents.length === 0}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-orange-200 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          {quizLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
          {quizLoading ? 'Đang chuẩn bị bộ câu hỏi cho bạn...' : `🎲 Bắt đầu thi thử (${quizDifficulty})`}
        </button>
      </div>

      {/* Vùng làm bài thi trắc nghiệm */}
      {quizData && quizData.length > 0 && (
        <div>
          {!quizSubmitted ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* KHỐI CÂU HỎI HIỆN TẠI (2 CỘT) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Thanh tiến trình */}
                <div className="bg-white p-4 rounded-3xl border border-sky-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Tiến trình làm bài</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-black text-sky-950">
                        Câu {currentQuestionIdx + 1} / {quizData.length}
                      </p>
                      {quizMeta?.from_cache && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          ⚡ Có sẵn ({quizMeta?.latency_sec}s)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-40 sm:w-48 bg-sky-100 h-3 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="bg-gradient-to-r from-emerald-400 to-sky-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${((currentQuestionIdx + 1) / quizData.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Card câu hỏi đang hiển thị */}
                {(() => {
                  const q = quizData[currentQuestionIdx];
                  if (!q) return null;
                  const currentSelected = userAnswers[currentQuestionIdx];

                  return (
                    <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/50 space-y-5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-xl text-xs font-extrabold shrink-0 border border-amber-200">
                          CÂU #{currentQuestionIdx + 1}
                        </span>
                        <h3 className="font-bold text-sky-950 text-sm leading-relaxed flex-1">
                          {q.question}
                        </h3>
                      </div>

                      {/* 4 Lựa chọn A B C D */}
                      <div className="space-y-3">
                        {Object.entries(q.options || {}).map(([key, optText]) => {
                          const isSelected = currentSelected === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setUserAnswers(prev => ({ ...prev, [currentQuestionIdx]: key }))}
                              className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border-2 text-xs text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-sky-500 bg-sky-50/90 text-sky-950 font-bold shadow-md shadow-sky-100 ring-2 ring-sky-300/50'
                                  : 'border-slate-200/80 bg-white hover:border-sky-300 hover:bg-sky-50/40 text-slate-700'
                              }`}
                            >
                              <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                                isSelected ? 'bg-sky-500 text-white shadow-xs' : 'bg-sky-100 text-sky-700'
                              }`}>
                                {key}
                              </span>
                              <span className="leading-normal font-medium">{optText}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Nút Điều hướng Câu trước / Câu tiếp theo */}
                      <div className="flex items-center justify-between pt-4 border-t border-sky-100">
                        <button
                          type="button"
                          disabled={currentQuestionIdx === 0}
                          onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                          className="px-4 py-2.5 border-2 border-sky-200 text-sky-800 rounded-2xl text-xs font-bold hover:bg-sky-50 disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" /> Câu trước
                        </button>

                        {currentQuestionIdx < quizData.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => setCurrentQuestionIdx(prev => Math.min(quizData.length - 1, prev + 1))}
                            className="px-5 py-2.5 bg-sky-500 text-white rounded-2xl text-xs font-bold hover:bg-sky-600 flex items-center gap-1.5 shadow-md shadow-sky-200 transition-all cursor-pointer"
                          >
                            Câu tiếp theo <ArrowRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onSubmitWithSave}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-emerald-200 flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                          >
                            Nộp bài & Nhận cúp 🏆
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* MA TRẬN ĐIỀU HƯỚNG CÂU HỎI BÊN CẠNH */}
              <div className="bg-white p-5 rounded-3xl border border-sky-100 shadow-md shadow-sky-100/50 h-fit space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-sky-950 uppercase tracking-wider">Bảng câu hỏi</span>
                  <span className="text-[11px] text-sky-600 font-bold bg-sky-100 px-2 py-0.5 rounded-full">
                    Đã làm {Object.keys(userAnswers).length}/{quizData.length}
                  </span>
                </div>

                {/* Lưới các ô câu hỏi 1..10 */}
                <div className="grid grid-cols-5 gap-2">
                  {quizData.map((_, idx) => {
                    const isAnswered = userAnswers[idx] !== undefined;
                    const isCurrent = currentQuestionIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentQuestionIdx(idx)}
                        className={`h-10 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                          isCurrent
                            ? 'bg-sky-500 text-white shadow-md shadow-sky-200 ring-2 ring-sky-300'
                            : isAnswered
                            ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-sky-50/60 text-sky-700 border border-sky-100 hover:bg-sky-100'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-sky-100">
                  <button
                    type="button"
                    onClick={onSubmitWithSave}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-xs font-bold hover:shadow-md transition-all text-center block cursor-pointer"
                  >
                    Hoàn thành & Xem điểm 🎉
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* BẢNG TỔNG KẾT KẾT QUẢ V XANH / X ĐỎ */
            <div className="space-y-5">
              {/* Bảng điểm tổng quan */}
              <div className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-sky-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                    Kết quả thi thử
                  </span>
                  <h3 className="text-3xl font-black mt-2">
                    {score.correct} / {score.total} câu đúng • Điểm: {score.score10}/10
                  </h3>
                  <p className="text-xs text-sky-100 mt-1 font-medium">
                    {Number(score.score10) >= 8.0 
                      ? '🎉 Quá xuất sắc! Bạn đã nắm bài học rất chắc chắn!' 
                      : '💪 Cố lên nhé! Cùng xem lại bài giải bên dưới để nắm chắc hơn nhé!'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuizSubmitted(false);
                    setUserAnswers({});
                    setCurrentQuestionIdx(0);
                    if (quizDoc) {
                      onGenerateQuiz(quizDifficulty, quizDoc, Number(numQuestions), true);
                    }
                  }}
                  className="px-6 py-3 bg-amber-400 text-amber-950 font-black text-xs rounded-2xl hover:bg-amber-300 shadow-md shadow-amber-500/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-4 h-4" /> Đảo câu thi lại 🔄
                </button>
              </div>

              {/* Chi tiết từng câu với V xanh và X đỏ */}
              <div className="space-y-4">
                {quizData.map((q, idx) => {
                  const userChoice = userAnswers[idx];
                  const isCorrect = userChoice === q.correct_answer;

                  return (
                    <div 
                      key={idx} 
                      className={`p-5 sm:p-6 rounded-3xl border-2 bg-white shadow-xs transition-all ${
                        isCorrect ? 'border-emerald-200' : 'border-rose-200'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className={`p-1.5 rounded-2xl shrink-0 ${isCorrect ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                          {isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                        </span>
                        <div className="flex-1">
                          <span className={`text-[11px] font-black uppercase tracking-wider ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isCorrect ? 'Đúng rồi nè ✨' : 'Chưa chính xác 💭'} • Câu #{idx + 1}
                          </span>
                          <h4 className="font-bold text-sky-950 text-sm mt-0.5">{q.question}</h4>
                        </div>
                      </div>

                      {/* Danh sách 4 đáp án */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 my-3 text-xs">
                        {Object.entries(q.options || {}).map(([key, optText]) => {
                          const isUserSelected = userChoice === key;
                          const isAnswerKey = q.correct_answer === key;
                          let style = 'border-slate-200/80 bg-slate-50/50 text-slate-700';

                          if (isAnswerKey) {
                            style = 'border-emerald-400 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-300';
                          } else if (isUserSelected && !isCorrect) {
                            style = 'border-rose-300 bg-rose-50 text-rose-950 font-medium line-through';
                          }

                          return (
                            <div key={key} className={`p-3 rounded-2xl border flex items-center gap-2.5 ${style}`}>
                              <span className="font-black">{key}.</span>
                              <span className="font-medium">{optText}</span>
                              {isAnswerKey && <span className="ml-auto text-[10px] text-emerald-800 font-extrabold bg-white border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">Đáp án chuẩn ⭐</span>}
                              {isUserSelected && !isCorrect && <span className="ml-auto text-[10px] text-rose-800 font-extrabold bg-white border border-rose-200 px-2 py-0.5 rounded-full shadow-2xs">Bạn đã chọn</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Lời giải thích */}
                      <div className="mt-3 p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/70 text-xs">
                        <p className="font-bold text-sky-950">
                          💡 Lời giải chi tiết: <span className="font-normal text-slate-700">{q.explanation}</span>
                        </p>
                        {q.source_note && (
                          <p className="text-[11px] text-sky-600 mt-1 font-medium">📌 Gợi nhớ kiến thức: {q.source_note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
