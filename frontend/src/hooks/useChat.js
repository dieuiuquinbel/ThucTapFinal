import { useState, useEffect, useRef } from 'react';
import axios, { API_BASE } from '../api/client';

export const DEFAULT_WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Chào bạn nhé! 🌟 Mình là Trợ lý Học tập Thông minh của bạn đây. Hãy tải lên tài liệu học tập ở góc bên trái, rồi hỏi mình bất kỳ bài học nào hoặc cùng làm bài tập nhé!',
  sources: []
};

export function useChat({ selectedDocFilter, systemStatus, showConfirm } = {}) {
  const [modelMode, setModelModeState] = useState(() => {
    try {
      return localStorage.getItem('smartstudy_model_mode') || 'deep';
    } catch (_) {
      return 'deep';
    }
  });

  const setModelMode = (mode) => {
    setModelModeState(mode);
    try {
      localStorage.setItem('smartstudy_model_mode', mode);
    } catch (_) {}
  };

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('smartstudy_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Không thể đọc lịch sử chat từ localStorage:', e);
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [openSources, setOpenSources] = useState({});
  const chatBottomRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('smartstudy_chat_history', JSON.stringify(messages));
    } catch (err) {
      console.error('Lỗi khi ghi lịch sử vào localStorage:', err);
    }
  }, [messages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleNewChat = () => {
    const doClear = () => {
      setMessages([DEFAULT_WELCOME_MESSAGE]);
      try {
        localStorage.removeItem('smartstudy_chat_history');
      } catch (_) {}
    };

    if (messages.length > 1) {
      if (showConfirm) {
        showConfirm({
          title: 'Hỏi bài học mới 💬',
          message: 'Bạn có muốn làm mới ngữ cảnh và bắt đầu cuộc trò chuyện mới không?',
          confirmText: 'Bắt đầu mới',
          cancelText: 'Giữ lại',
          confirmVariant: 'primary',
          onConfirm: doClear
        });
        return;
      } else if (!window.confirm('Bạn có muốn làm mới ngữ cảnh và bắt đầu cuộc trò chuyện mới không?')) {
        return;
      }
    }
    doClear();
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputQuery.trim() || chatLoading) return;

    const q = inputQuery.trim();
    setInputQuery('');
    const startTime = Date.now();
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setChatLoading(true);

    const recentHistory = messages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          filter_source: selectedDocFilter,
          top_k: 4,
          history: recentHistory,
          model_mode: modelMode
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Không thể khởi tạo streaming response');
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          sources: [],
          latency: 0,
          modelUsed: systemStatus?.active_model || 'qwen2.5:7b',
          isFallback: false
        }
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let metaSources = [];
      let activeModel = '';
      let sseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.replace('data: ', '').trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'meta') {
              metaSources = parsed.sources || [];
              activeModel = parsed.model || '';
              const finalElapsed = Math.round((Date.now() - startTime) / 100) / 10;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    sources: metaSources,
                    modelUsed: activeModel || last.modelUsed,
                    latency: finalElapsed
                  };
                }
                return next;
              });
            } else if (parsed.type === 'token') {
              accumulatedText += parsed.token;
              const currentElapsed = Math.round((Date.now() - startTime) / 100) / 10;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    content: accumulatedText,
                    latency: currentElapsed
                  };
                }
                return next;
              });
            }
          } catch (_) {}
        }
      }

      // Kích hoạt nạp ngầm Quiz & Tóm tắt trong lúc học viên rảnh tay đọc câu trả lời (sau 2.5s)
      const targetDoc = (selectedDocFilter && selectedDocFilter !== 'Tất cả tài liệu')
        ? selectedDocFilter
        : (metaSources[0]?.source || null);

      if (targetDoc) {
        setTimeout(() => {
          axios.post(`${API_BASE}/precompute/${encodeURIComponent(targetDoc)}`).catch(() => {});
        }, 2500);
      }
    } catch (err) {
      try {
        const res = await axios.post(`${API_BASE}/chat`, {
          query: q,
          filter_source: selectedDocFilter,
          top_k: 4,
          history: recentHistory,
          model_mode: modelMode
        });
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.answer,
            sources: res.data.sources || [],
            latency: res.data.latency_sec,
            modelUsed: res.data.model_used,
            isFallback: res.data.is_fallback
          }
        ]);
      } catch (fallbackErr) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Đã xảy ra lỗi khi kết nối tới mô hình AI: ' + (fallbackErr.response?.data?.detail || fallbackErr.message),
            sources: []
          }
        ]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  return {
    messages,
    inputQuery,
    setInputQuery,
    chatLoading,
    openSources,
    setOpenSources,
    chatBottomRef,
    handleNewChat,
    handleSendMessage,
    modelMode,
    setModelMode
  };
}
