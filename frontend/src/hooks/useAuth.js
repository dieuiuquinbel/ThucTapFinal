import { useState, useEffect } from 'react';
import axios, { API_BASE, setAuthTokenHeader } from '../api/client';

export function useAuth(options = {}) {
  const { showAlert } = options;
  const triggerAlert = (message, title = 'Thông báo', icon = 'info') => {
    if (showAlert) {
      showAlert(message, { title, icon });
    } else {
      alert(message);
    }
  };

  const [authToken, setAuthToken] = useState(() => localStorage.getItem('smartstudy_token') || '');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('smartstudy_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'verify'
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '', otp: '', avatar: '🐱' });
  const [authLoading, setAuthLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [quizHistoryModalOpen, setQuizHistoryModalOpen] = useState(false);
  const [quizHistoryList, setQuizHistoryList] = useState([]);
  const [devOtpHit, setDevOtpHit] = useState('');

  // Tự động gắn token vào axios header
  useEffect(() => {
    setAuthTokenHeader(authToken);
  }, [authToken]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setDevOtpHit('');
    try {
      if (authMode === 'login') {
        const res = await axios.post(`${API_BASE}/auth/login`, {
          email: authForm.email,
          password: authForm.password
        });
        if (res.data.success) {
          const { token, user } = res.data.data;
          setAuthToken(token);
          setCurrentUser(user);
          try {
            localStorage.setItem('smartstudy_token', token);
            localStorage.setItem('smartstudy_user', JSON.stringify(user));
          } catch (_) {}
          setAuthModalOpen(false);
          triggerAlert(`Chào mừng bạn ${user.full_name} quay trở lại học tập! 🌟`, 'Đăng nhập thành công', 'success');
        }
      } else if (authMode === 'register') {
        const res = await axios.post(`${API_BASE}/auth/register`, {
          email: authForm.email,
          full_name: authForm.fullName,
          password: authForm.password,
          avatar: authForm.avatar || '🐱'
        });
        if (res.data.success) {
          if (res.data.data.dev_otp) {
            setDevOtpHit(res.data.data.dev_otp);
          }
          setAuthMode('verify');
          triggerAlert('Đã gửi mã xác nhận! Vui lòng nhập mã OTP để kích hoạt tài khoản.', 'Xác thực tài khoản', 'info');
        }
      } else if (authMode === 'verify') {
        const res = await axios.post(`${API_BASE}/auth/verify-otp`, {
          email: authForm.email,
          otp: authForm.otp
        });
        if (res.data.success) {
          const { token, user } = res.data.data;
          setAuthToken(token);
          setCurrentUser(user);
          try {
            localStorage.setItem('smartstudy_token', token);
            localStorage.setItem('smartstudy_user', JSON.stringify(user));
          } catch (_) {}
          setAuthModalOpen(false);
          triggerAlert(`Kích hoạt tài khoản thành công! Chào bạn ${user.full_name} ✨`, 'Kích hoạt thành công', 'success');
        }
      }
    } catch (err) {
      triggerAlert('Lỗi: ' + (err.response?.data?.detail || err.message), 'Thất bại', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    setUserMenuOpen(false);
    try {
      localStorage.removeItem('smartstudy_token');
      localStorage.removeItem('smartstudy_user');
    } catch (_) {}
    triggerAlert('Đã đăng xuất tài khoản thành công!', 'Đăng xuất', 'info');
  };

  const handleFetchQuizHistory = async () => {
    if (!currentUser) return;
    try {
      const res = await axios.get(`${API_BASE}/user/quiz-history`);
      if (res.data.success) {
        setQuizHistoryList(res.data.data);
        setQuizHistoryModalOpen(true);
        setUserMenuOpen(false);
      }
    } catch (err) {
      triggerAlert('Không thể tải lịch sử điểm: ' + (err.response?.data?.detail || err.message), 'Lỗi tải lịch sử', 'error');
    }
  };

  return {
    authToken,
    currentUser,
    authModalOpen,
    setAuthModalOpen,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    authLoading,
    userMenuOpen,
    setUserMenuOpen,
    quizHistoryModalOpen,
    setQuizHistoryModalOpen,
    quizHistoryList,
    devOtpHit,
    setDevOtpHit,
    handleAuthSubmit,
    handleLogout,
    handleFetchQuizHistory
  };
}
