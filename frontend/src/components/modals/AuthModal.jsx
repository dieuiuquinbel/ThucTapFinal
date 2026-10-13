import React from 'react';
import { Sparkles, RefreshCw, Lock } from 'lucide-react';

export default function AuthModal({
  isOpen,
  onClose,
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authLoading,
  devOtpHit,
  setDevOtpHit,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-sky-100 relative">
        <button
          onClick={() => {
            onClose();
            if (setDevOtpHit) setDevOtpHit('');
          }}
          className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
        >
          ✕
        </button>

        {/* Header Modal */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white mx-auto shadow-md shadow-sky-300/40 mb-2">
            <Sparkles className="w-6 h-6 text-yellow-200 fill-yellow-200" />
          </div>
          <h2 className="text-xl font-black text-sky-950">
            {authMode === 'login' && 'Chào mừng bạn trở lại! 👋'}
            {authMode === 'register' && 'Tạo tài khoản học viên mới 🌟'}
            {authMode === 'verify' && 'Xác thực mã OTP Email 📩'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {authMode === 'login' && 'Đăng nhập để xem sách và bảng điểm của riêng bạn.'}
            {authMode === 'register' && 'Đăng ký ngay để lưu trữ tiến trình học tập cá nhân.'}
            {authMode === 'verify' && `Nhập mã 6 chữ số gửi về: ${authForm.email}`}
          </p>
        </div>

        {/* Chuyển tab Đăng nhập / Đăng ký */}
        {authMode !== 'verify' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-sky-50 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                authMode === 'login' ? 'bg-white text-sky-950 shadow-xs' : 'text-slate-500 hover:text-sky-800'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                authMode === 'register' ? 'bg-white text-sky-950 shadow-xs' : 'text-slate-500 hover:text-sky-800'
              }`}
            >
              Đăng ký
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          {authMode === 'register' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Họ và tên của bạn</label>
                <input
                  type="text"
                  required
                  value={authForm.fullName}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Ví dụ: Diệu Nguyễn"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-sky-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Chọn biểu tượng Avatar đại diện</label>
                <div className="flex gap-2">
                  {['🐱', '🐼', '🦊', '🦉', '🚀', '⭐'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAuthForm(prev => ({ ...prev, avatar: emoji }))}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border-2 transition-all cursor-pointer ${
                        authForm.avatar === emoji ? 'border-sky-500 bg-sky-50 scale-110 shadow-xs' : 'border-slate-100 hover:border-sky-200 bg-slate-50'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {authMode !== 'verify' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Địa chỉ Email</label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="ten_ban@gmail.com"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-sky-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-sky-500 focus:bg-white font-medium"
                />
              </div>
            </>
          )}

          {authMode === 'verify' && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Mã xác thực OTP (6 số)</label>
              <input
                type="text"
                required
                maxLength={6}
                value={authForm.otp}
                onChange={(e) => setAuthForm(prev => ({ ...prev, otp: e.target.value }))}
                placeholder="Nhập 6 số..."
                className="w-full text-center tracking-widest text-lg font-mono font-bold bg-sky-50 border-2 border-sky-300 rounded-xl p-3 focus:outline-none focus:border-sky-500 text-sky-950"
              />
              {devOtpHit && (
                <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center font-bold">
                  ⚡ Mã OTP thử nghiệm nhanh: <span className="font-mono text-sm underline">{devOtpHit}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-sky-200 transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {authLoading ? 'Đang kiểm tra...' : (
              authMode === 'login' ? 'Đăng nhập ngay' :
              authMode === 'register' ? 'Tiếp tục đăng ký' : 'Xác thực & Vào học ngay'
            )}
          </button>
        </form>

        {authMode === 'verify' && (
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className="w-full text-center text-xs font-bold text-slate-400 hover:text-sky-600 mt-4 cursor-pointer"
          >
            ← Quay lại đăng nhập
          </button>
        )}
      </div>
    </div>
  );
}
