import React from 'react';
import { X, Sparkles, Trash2, HelpCircle, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';

export default function NoticeModal({
  isOpen,
  onClose,
  type = 'confirm', // 'confirm' | 'info' | 'error' | 'success' | 'warning'
  title = 'Thông báo',
  message = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  confirmVariant = 'danger', // 'danger' | 'primary'
  onConfirm
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const getIcon = () => {
    if (type === 'confirm') {
      return confirmVariant === 'danger' ? (
        <Trash2 className="w-6 h-6 text-rose-500" />
      ) : (
        <MessageSquare className="w-6 h-6 text-sky-500" />
      );
    }
    if (type === 'error') return <AlertCircle className="w-6 h-6 text-rose-500" />;
    if (type === 'success') return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
    if (type === 'warning') return <AlertCircle className="w-6 h-6 text-amber-500" />;
    return <HelpCircle className="w-6 h-6 text-sky-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      {/* Vùng Bảng Ghi Chú Học Tập (Inspiration từ khung bảng vẽ học tập có mây, sao, giấy note) */}
      <div className="relative w-full max-w-md pt-5">
        
        {/* Dây treo và Đinh ghim bảng phía trên */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-20">
          <div className="w-4 h-4 rounded-full bg-sky-400 border-2 border-white shadow-md"></div>
          <div className="w-24 h-5 border-t-2 border-l border-r border-sky-300 rounded-t-xl -mt-1 opacity-70"></div>
        </div>

        {/* Khung Bảng Học Tập chính */}
        <div className="relative bg-[#fffef9] border-4 border-sky-300 rounded-[2.2rem] p-6 sm:p-7 shadow-2xl text-center overflow-visible">
          
          {/* Nút X đóng thông báo */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 flex items-center justify-center text-xs font-black transition-transform hover:scale-110 active:scale-95 cursor-pointer z-30 shadow-2xs"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Trang trí Mây bồng bềnh & Ngôi sao góc trên bên trái */}
          <div className="absolute -top-5 -left-4 pointer-events-none select-none z-10 animate-bounce duration-1000">
            <div className="relative flex items-center">
              {/* Cụm mây trắng phồng */}
              <div className="relative bg-white border-2 border-sky-200 rounded-full px-3 py-1 shadow-sm flex items-center gap-1">
                <span className="text-xl">☁️</span>
                <span className="text-base -ml-1 text-amber-400 animate-spin duration-3000">⭐</span>
              </div>
            </div>
          </div>

          {/* Trang trí Bông hoa học tập góc trên bên phải */}
          <div className="absolute -top-3 -right-2 pointer-events-none select-none z-10">
            <span className="text-2xl filter drop-shadow-xs">🌸</span>
          </div>

          {/* 3 Thẻ Giấy Note pastel kẹp bên mép trái bảng (Sticky Notes) */}
          <div className="absolute left-[-10px] top-14 flex flex-col gap-2 pointer-events-none select-none z-10">
            <div className="w-4 h-8 bg-emerald-200/90 border border-emerald-300 rounded-r-md shadow-2xs transform -rotate-3"></div>
            <div className="w-4 h-8 bg-amber-200/90 border border-amber-300 rounded-r-md shadow-2xs transform rotate-2"></div>
            <div className="w-4 h-8 bg-rose-200/90 border border-rose-300 rounded-r-md shadow-2xs transform -rotate-1"></div>
          </div>

          {/* Cụm Ngôi sao vàng góc dưới bên phải */}
          <div className="absolute -bottom-3 -right-2 pointer-events-none select-none z-10 flex items-end">
            <span className="text-xl text-amber-400">✨</span>
            <span className="text-2xl -ml-1 text-amber-400">⭐</span>
          </div>

          {/* Icon tròn nổi bật ở trung tâm */}
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3.5 bg-gradient-to-tr from-sky-50 to-blue-50 border-2 border-sky-200/80 flex items-center justify-center shadow-inner">
            {getIcon()}
          </div>

          {/* Tiêu đề thông báo */}
          <h3 className="text-lg font-black text-sky-950 mb-2 tracking-tight">
            {title}
          </h3>

          {/* Nội dung thông báo */}
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium px-2 mb-6 whitespace-pre-line">
            {message}
          </p>

          {/* Các nút bấm hành động */}
          <div className="flex items-center justify-center gap-2.5">
            {type === 'confirm' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`flex-1 py-2.5 px-4 rounded-2xl text-white font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer ${
                    confirmVariant === 'danger'
                      ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-rose-200'
                      : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 shadow-sky-200'
                  }`}
                >
                  {confirmText}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Đã hiểu rồi</span>
                <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
