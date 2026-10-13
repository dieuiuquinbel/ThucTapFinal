import React from 'react';
import { 
  Sparkles, Plus, Smile, Upload, BookOpen, 
  RefreshCw, Trash2, History, Smartphone, Settings, 
  HelpCircle, LogOut, MoreHorizontal, User 
} from 'lucide-react';

export default function Sidebar({
  systemStatus,
  documents,
  selectedDocFilter,
  setSelectedDocFilter,
  uploading,
  uploadProgress,
  uploadStep,
  onFileUpload,
  onCancelUpload,
  onDeleteDoc,
  onNewChat,
  currentUser,
  userMenuOpen,
  setUserMenuOpen,
  onOpenAuthModal,
  onLogout,
  onFetchQuizHistory,
  onNavigateGuidelines
}) {
  return (
    <aside className="w-80 bg-white border-r border-sky-100 flex flex-col justify-between shrink-0 shadow-sm z-10">
      <div className="p-5 overflow-y-auto">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-sky-300/40 transform hover:rotate-6 transition-transform">
            <Sparkles className="w-6 h-6 text-yellow-200 fill-yellow-200" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sky-950 text-lg leading-tight tracking-tight">SmartStudy</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Bé ngoan ✨</span>
            </div>
            <p className="text-xs text-sky-600 font-medium">Bạn cùng tiến học tập 4.0</p>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full mb-4 py-2.5 px-3.5 rounded-2xl border-2 border-sky-200 hover:border-sky-400 bg-sky-50/60 hover:bg-sky-100/70 text-sky-900 font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-sky-500 text-white flex items-center justify-center group-hover:scale-110 shadow-xs transition-all">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </span>
            <span>Đặt câu hỏi mới</span>
          </div>
          <span className="text-[11px] text-sky-600 font-semibold bg-white px-2 py-0.5 rounded-full border border-sky-200 group-hover:border-sky-300 shadow-2xs">
            Mới 💬
          </span>
        </button>

        {/* Trạng thái Bạn Trợ lý (Model AI) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50/80 to-blue-50/50 border border-sky-200/80 mb-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5 text-amber-500" /> Bạn trợ lý AI
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              systemStatus?.is_fallback 
                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${systemStatus?.is_fallback ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
              {systemStatus?.is_fallback ? 'Đang trực phụ' : 'Sẵn sàng 100%'}
            </span>
          </div>
          <div className="text-xs font-bold text-sky-950 flex items-center gap-1">
            <span>🤖 {systemStatus?.active_model || 'Đang kết nối trợ lý...'}</span>
          </div>
          <div className="text-[11px] text-sky-700/80 mt-1 flex items-center gap-2">
            <span>Nhớ được: {systemStatus?.total_chunks || 0} bài học</span>
            <span>•</span>
            <span className="text-emerald-600 font-semibold">Chạy trên máy 100%</span>
          </div>
        </div>

        {/* Hộp nạp tài liệu vào balo */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-sky-600" /> Nạp bài giảng vào balo
            </span>
          </div>

          {!uploading ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-4 cursor-pointer transition-all border-sky-300 hover:border-sky-500 hover:bg-sky-50/80 bg-white group">
              <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-sky-900 text-center">
                Bấm để chọn bài học
              </span>
              <span className="text-[11px] text-sky-500 mt-0.5">File PDF, Word (.docx), Text</span>
              <input 
                type="file" 
                multiple 
                accept=".pdf,.docx,.txt" 
                onChange={onFileUpload} 
                className="hidden" 
              />
            </label>
          ) : (
            <div className="border border-sky-300 bg-sky-50 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-sky-900 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" /> Đang đọc bài học...
                </span>
                <span className="font-bold text-sky-700 font-mono">{uploadProgress}%</span>
              </div>

              {/* Thanh tiến trình */}
              <div className="w-full bg-sky-200 h-2.5 rounded-full overflow-hidden p-0.5">
                <div 
                  className="bg-gradient-to-r from-sky-500 to-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <p className="text-[11px] text-sky-700 truncate" title={uploadStep}>
                {uploadStep || 'Đang chuẩn bị trang học...'}
              </p>

              {/* Nút Hủy */}
              <button
                type="button"
                onClick={onCancelUpload}
                className="w-full py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                ✕ Dừng lại
              </button>
            </div>
          )}
        </div>

        {/* Danh sách sách trong Balo (Indexed Documents) */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1">
              📚 Sách đã nạp ({documents.length})
            </span>
          </div>
          {documents.length === 0 ? (
            <div className="p-3 rounded-2xl bg-sky-50/60 border border-sky-100 text-center">
              <p className="text-xs text-sky-600 italic">Balo chưa có sách nào. Hãy tải lên nhé!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-sky-100 shadow-2xs text-xs hover:border-sky-300 transition-all">
                  <div className="truncate mr-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 font-bold text-[10px]">
                      📄
                    </span>
                    <div className="truncate">
                      <p className="font-bold text-sky-950 truncate" title={doc.source}>{doc.source}</p>
                      <p className="text-[11px] text-sky-600">{doc.total_pages} trang • {doc.chunks} đoạn kiến thức</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteDoc(doc.source)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Cất sách này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chọn phạm vi học */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-sky-900 block mb-1.5 flex items-center gap-1">
            🎯 Phạm vi ôn tập
          </label>
          <select 
            value={selectedDocFilter}
            onChange={(e) => setSelectedDocFilter(e.target.value)}
            className="w-full text-xs font-semibold bg-white border border-sky-200 rounded-xl p-2.5 text-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-2xs"
          >
            <option value="Tất cả tài liệu">🌟 Toàn bộ bài trong Balo</option>
            {documents.map((d, i) => (
              <option key={i} value={d.source}>📖 {d.source}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Footer Sidebar: Profile học viên hoặc Nút Đăng nhập */}
      <div className="p-3 border-t border-sky-100 bg-white relative">
        {currentUser ? (
          <div className="relative">
            {/* Menu Popup */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-xl border border-sky-100 py-2 z-50 text-xs font-semibold text-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2.5">
                  <span className="text-2xl">{currentUser.avatar || '🐱'}</span>
                  <div className="truncate">
                    <p className="font-bold text-slate-900 truncate">{currentUser.full_name}</p>
                    <p className="text-[11px] text-slate-400 font-normal truncate">{currentUser.email}</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setUserMenuOpen(false);
                    onFetchQuizHistory();
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <History className="w-4 h-4 text-amber-500" />
                  <span>Lịch sử điểm & đánh giá 🏆</span>
                </button>

                <button 
                  onClick={() => {
                    setUserMenuOpen(false);
                    alert('Ứng dụng di động đang được phát triển!');
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  <span>Tải ứng dụng di động</span>
                </button>

                <button 
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigateGuidelines();
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Cài đặt & Nguyên tắc</span>
                </button>

                <button 
                  onClick={() => {
                    setUserMenuOpen(false);
                    alert('Liên hệ hỗ trợ: support@smartstudy.edu.vn');
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>Trợ giúp & Phản hồi</span>
                </button>

                <div className="my-1 border-t border-slate-100"></div>

                <button 
                  onClick={onLogout}
                  className="w-full px-4 py-2.5 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}

            {/* Thẻ User Profile */}
            <div 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center justify-between p-2 rounded-2xl hover:bg-sky-50/80 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-lg shadow-2xs group-hover:scale-105 transition-transform">
                  {currentUser.avatar || '🐱'}
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-800 text-xs truncate">{currentUser.full_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
                </div>
              </div>
              <button 
                type="button"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="w-full py-2.5 px-3 rounded-2xl border-2 border-sky-200 bg-white hover:bg-sky-50 text-sky-900 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-sky-500 group-hover:text-white transition-colors">
              <User className="w-3.5 h-3.5" />
            </div>
            <span>Đăng nhập tài khoản</span>
          </button>
        )}
      </div>
    </aside>
  );
}
