import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  BookOpen, MessageSquare, Award, Layers, FileText, 
  Upload, Trash2, CheckCircle2, AlertCircle, RefreshCw, 
  Send, ChevronDown, ChevronUp, Copy, Download, Cpu, 
  HelpCircle, BookMarked, Sparkles, Server, ArrowRight, ArrowLeft, XCircle, CheckCircle,
  RotateCcw, Plus
} from 'lucide-react';

const API_BASE = '/api';

const DEFAULT_WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Xin chào! Tôi là Trợ lý Học tập Thông minh được hỗ trợ bởi Local LLM và kỹ thuật RAG. Hãy tải lên tài liệu PDF môn học ở thanh bên trái và đặt câu hỏi cho tôi nhé!',
  sources: []
};

// Xử lý in đậm inline và trích dẫn [1], [2]
function renderInlineFormattedText(text) {
  if (!text) return null;
  const tokens = text.split(/(\*\*.*?\*\*|\[\d+\])/g);

  return tokens.map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      const boldContent = tok.slice(2, -2).trim();
      return (
        <strong key={idx} className="font-bold text-slate-900 bg-amber-50/90 px-1 py-0.5 rounded text-[13px] border border-amber-200/60">
          {boldContent}
        </strong>
      );
    }
    const citationMatch = tok.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      return (
        <span 
          key={idx} 
          className="inline-flex items-center px-1.5 py-0.2 mx-0.5 text-[11px] font-bold text-blue-700 bg-blue-100/90 border border-blue-300 rounded font-mono shadow-3xs"
          title={`Trích dẫn nguồn [${citationMatch[1]}]`}
        >
          [{citationMatch[1]}]
        </span>
      );
    }
    const cleanTok = tok.replace(/\\\*/g, '*').replace(/(?<!\*)\*(?!\*)/g, '');
    return <span key={idx}>{cleanTok}</span>;
  });
}

// Component hiển thị nội dung tóm tắt gọn gàng: Section heading + list item dạng ghi chú sách
function RichContentRenderer({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentParagraph = [];
  let listBuffer = []; // Gom nhiều bullet liên tiếp vào 1 khối

  const flushParagraph = (keyPrefix) => {
    if (currentParagraph.length > 0) {
      const pText = currentParagraph.join(' ').trim();
      if (pText) {
        elements.push(
          <p key={`${keyPrefix}-${elements.length}`} className="leading-relaxed text-slate-700 my-1.5 text-[13px]">
            {renderInlineFormattedText(pText)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushListBuffer = (keyPrefix) => {
    if (listBuffer.length > 0) {
      elements.push(
        <div key={`list-${keyPrefix}`} className="my-2 ml-1 space-y-1 border-l-2 border-indigo-200 pl-3.5">
          {listBuffer.map((item, idx) => item)}
        </div>
      );
      listBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph(`p-${i}`);
      flushListBuffer(i);
      continue;
    }

    // 1. Tiêu đề lớn: ### hoặc ## hoặc PHẦN N: hoặc chữ in hoa dạng "1. CÁC KHÁI NIỆM..."
    const headingMatch = line.match(/^(?:###?\s*\d*\.?\s*|PHẦN\s+\d+\s*[:\-]?\s*)(.+)$/i);
    if (headingMatch) {
      flushParagraph(`head-${i}`);
      flushListBuffer(i);
      const headingTitle = headingMatch[1].replace(/\*\*/g, '').trim();
      elements.push(
        <div key={`h-${i}`} className="mt-5 mb-2 p-2.5 rounded-lg bg-gradient-to-r from-blue-50 via-indigo-50/50 to-transparent border-l-4 border-blue-500 flex items-center gap-2 text-blue-900 font-bold text-[13px]">
          <span>{headingTitle}</span>
        </div>
      );
      continue;
    }

    // 2. Sub-heading: **a. Tiêu đề** hoặc **I. Tiêu đề** hoặc **Nguồn gốc nhận thức** (dòng chỉ có bold)
    const subHeadingMatch = line.match(/^\*\*(.*?)\*\*\s*$/);
    if (subHeadingMatch && !line.includes(':')) {
      flushParagraph(`subh-${i}`);
      flushListBuffer(i);
      const subTitle = subHeadingMatch[1].trim();
      elements.push(
        <div key={`sh-${i}`} className="mt-3 mb-1.5 font-semibold text-indigo-800 text-[13px] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
          <span>{subTitle}</span>
        </div>
      );
      continue;
    }

    // 3. Concept item: "- **Khái niệm**: Giải thích..." hoặc "1. **Khái niệm**: Giải thích..."
    //    Hiển thị dạng list item gọn gàng, KHÔNG dùng card box riêng lẻ
    const conceptMatch = line.match(/^(\d+[\.)]|[-*•])\s*\*\*(.*?)\*\*\s*[:\-]?\s*(.*)$/);
    if (conceptMatch) {
      flushParagraph(`c-${i}`);
      const conceptName = conceptMatch[2].trim();
      const explanation = conceptMatch[3].trim();

      listBuffer.push(
        <div key={`item-${i}`} className="py-1">
          <span className="font-semibold text-slate-900 text-[13px]">{conceptName}</span>
          {explanation && (
            <span className="text-slate-600 text-[13px]">
              {': '}{renderInlineFormattedText(explanation)}
            </span>
          )}
        </div>
      );
      continue;
    }

    // 4. Gạch đầu dòng thông thường (không có bold title): "- nội dung"
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph(`b-${i}`);
      listBuffer.push(
        <div key={`b-${i}`} className="flex items-start gap-2 py-0.5">
          <span className="w-1 h-1 rounded-full bg-slate-400 mt-[7px] shrink-0"></span>
          <span className="text-slate-700 text-[13px] leading-relaxed flex-1">
            {renderInlineFormattedText(bulletMatch[1])}
          </span>
        </div>
      );
      continue;
    }

    // 5. Dòng đánh số không có bold: "1. Nội dung"
    const numberedMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph(`n-${i}`);
      listBuffer.push(
        <div key={`n-${i}`} className="flex items-start gap-2 py-0.5">
          <span className="text-indigo-500 font-bold text-[12px] mt-px shrink-0 min-w-[16px]">{numberedMatch[1]}.</span>
          <span className="text-slate-700 text-[13px] leading-relaxed flex-1">
            {renderInlineFormattedText(numberedMatch[2])}
          </span>
        </div>
      );
      continue;
    }

    // 6. Đoạn văn bản thường
    flushListBuffer(i);
    currentParagraph.push(line);
  }

  flushParagraph('final');
  flushListBuffer('final');
  return <div className="space-y-0.5">{elements}</div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [systemStatus, setSystemStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocFilter, setSelectedDocFilter] = useState('Tất cả tài liệu');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const uploadAbortRef = useRef(null);

  // Chat State (Lưu trữ bền vững trong localStorage - F5 không mất)
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
  const chatBottomRef = useRef(null);

  // Quiz State
  const [quizDoc, setQuizDoc] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [quizDifficulty, setQuizDifficulty] = useState('Trung bình');
  const [quizData, setQuizData] = useState(null);
  const [quizMeta, setQuizMeta] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  // Flashcards State
  const [fcDoc, setFcDoc] = useState('');
  const [numCards, setNumCards] = useState(6);
  const [flashcards, setFlashcards] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [fcLoading, setFcLoading] = useState(false);

  // Summary State
  const [sumDoc, setSumDoc] = useState('');
  const [sumStyle, setSumStyle] = useState('Chuẩn học thuật');
  const [summaryResult, setSummaryResult] = useState(null);
  const [sumLoading, setSumLoading] = useState(false);

  // Accordion open sources
  const [openSources, setOpenSources] = useState({});

  // Fetch initial data
  const fetchStatusAndDocs = async () => {
    try {
      const [resStatus, resDocs] = await Promise.all([
        axios.get(`${API_BASE}/status`),
        axios.get(`${API_BASE}/documents`)
      ]);
      setSystemStatus(resStatus.data);
      setDocuments(resDocs.data);
      if (resDocs.data.length > 0) {
        if (!quizDoc) setQuizDoc(resDocs.data[0].source);
        if (!fcDoc) setFcDoc(resDocs.data[0].source);
        if (!sumDoc) setSumDoc(resDocs.data[0].source);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu khởi tạo:', err);
    }
  };

  useEffect(() => {
    fetchStatusAndDocs();
    const interval = setInterval(fetchStatusAndDocs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Đồng bộ lưu trữ lịch sử hội thoại vào localStorage (F5 không mất)
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem('smartstudy_chat_history', JSON.stringify(messages));
      }
    } catch (err) {
      console.error('Lỗi khi ghi lịch sử vào localStorage:', err);
    }
  }, [messages]);

  // Cuộc trò chuyện mới / Xóa sạch bộ nhớ ngữ cảnh
  const handleNewChat = () => {
    if (messages.length > 1) {
      if (!window.confirm('Bạn có muốn làm mới ngữ cảnh và bắt đầu cuộc trò chuyện mới không?')) {
        return;
      }
    }
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    try {
      localStorage.removeItem('smartstudy_chat_history');
    } catch (_) {}
  };

  // Handle Cancel Upload
  const handleCancelUpload = () => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadStep('');
  };

  // Handle File Upload with Visual Progress
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setUploading(true);
    setUploadProgress(5);
    setUploadStep('Đang tải tệp lên server...');

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const uploadStartTime = Date.now();

    // Tiến trình thực tế hơn - tăng chậm và liên tục đến 98%
    // Embedding bge-m3 qua Ollama mất ~2-3s/chunk, nên cần kiên nhẫn
    const progressTimer = setInterval(() => {
      const elapsed = Math.round((Date.now() - uploadStartTime) / 1000);
      setUploadProgress(prev => {
        if (prev < 20) {
          setUploadStep(`Đang trích xuất văn bản... (${elapsed}s)`);
          return prev + 3;
        } else if (prev < 50) {
          setUploadStep(`Đang nhúng vector BGE-M3 qua Ollama... (${elapsed}s)`);
          return prev + 2;
        } else if (prev < 75) {
          setUploadStep(`Đang nhúng vector & lưu ChromaDB... (${elapsed}s)`);
          return prev + 1;
        } else if (prev < 90) {
          setUploadStep(`Đang đồng bộ hóa ChromaDB... (${elapsed}s)`);
          return prev + 0.5;
        } else if (prev < 98) {
          setUploadStep(`Sắp hoàn tất, vui lòng chờ... (${elapsed}s)`);
          return prev + 0.2;
        }
        return prev;
      });
    }, 1000);

    try {
      await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        timeout: 180000  // 180 giây timeout cho file lớn
      });
      clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadStep('✅ Hoàn tất!');
      await fetchStatusAndDocs();
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      }, 1200);
    } catch (err) {
      clearInterval(progressTimer);
      if (axios.isCancel(err) || err.name === 'CanceledError') {
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      } else if (err.code === 'ECONNABORTED') {
        alert('Quá thời gian xử lý (>180s). Hãy thử tải lên tài liệu nhỏ hơn hoặc kiểm tra Ollama.');
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      } else {
        alert('Lỗi khi xử lý tài liệu: ' + (err.response?.data?.detail || err.message));
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      }
    } finally {
      uploadAbortRef.current = null;
      e.target.value = null;
    }
  };

  // Handle Delete Document
  const handleDeleteDoc = async (sourceName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${sourceName}"?\nHệ thống sẽ xóa toàn bộ vector, cache tóm tắt và cache đề thi tương ứng.`)) return;
    try {
      await axios.delete(`${API_BASE}/documents/${encodeURIComponent(sourceName)}`);
      if (sumDoc === sourceName) {
        setSummaryResult(null);
      }
      if (quizDoc === sourceName) {
        setQuizData(null);
        setQuizMeta(null);
      }
      await fetchStatusAndDocs();
    } catch (err) {
      alert('Lỗi khi xóa tài liệu: ' + err.message);
    }
  };

  // Handle Send Chat with Streaming
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputQuery.trim() || chatLoading) return;

    const q = inputQuery.trim();
    setInputQuery('');
    const startTime = Date.now();
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setChatLoading(true);

    try {
      // Lấy tối đa 6 messages gần nhất (3 cặp hỏi-đáp) để gửi làm ngữ cảnh hội thoại
      const recentHistory = messages
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          filter_source: selectedDocFilter,
          top_k: 4,
          history: recentHistory
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Không thể khởi tạo streaming response');
      }

      // Thêm message assistant rỗng để stream text vào dần
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
        // Giữ lại phần chưa hoàn thành (chưa có ký tự xuống dòng) vào buffer
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
    } catch (err) {
      // Fallback sang endpoint thường nếu streaming lỗi
      try {
        const res = await axios.post(`${API_BASE}/chat`, {
          query: q,
          filter_source: selectedDocFilter,
          top_k: 4,
          history: recentHistory
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

  // Handle Generate Quiz
  const handleGenerateQuiz = async (overrideDifficulty = null) => {
    if (!quizDoc) {
      alert('Vui lòng chọn tài liệu để sinh đề!');
      return;
    }
    const targetDiff = overrideDifficulty || quizDifficulty;
    setQuizLoading(true);
    setQuizSubmitted(false);
    setUserAnswers({});
    setCurrentQuestionIdx(0);
    try {
      const res = await axios.post(`${API_BASE}/quiz`, {
        document_source: quizDoc,
        num_questions: Number(numQuestions),
        difficulty: targetDiff
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setQuizData(res.data.data);
        setQuizMeta(res.data);
        setCurrentQuestionIdx(0);
      } else {
        alert('Mô hình chưa thể sinh JSON trắc nghiệm. Vui lòng bấm thử lại!');
      }
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setQuizLoading(false);
    }
  };

  // Handle Generate Flashcards
  const handleGenerateFlashcards = async () => {
    if (!fcDoc) {
      alert('Vui lòng chọn tài liệu để tạo Flashcards!');
      return;
    }
    setFcLoading(true);
    setFlippedCards({});
    try {
      const res = await axios.post(`${API_BASE}/flashcards`, {
        document_source: fcDoc,
        num_cards: Number(numCards)
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setFlashcards(res.data.data);
      } else {
        alert('Không thể tạo flashcard. Vui lòng thử lại!');
      }
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setFcLoading(false);
    }
  };

  // Handle Generate Summary
  const handleGenerateSummary = async (overrideStyle = null) => {
    if (!sumDoc) {
      alert('Vui lòng chọn tài liệu để tóm tắt!');
      return;
    }
    const targetStyle = overrideStyle || sumStyle;
    setSumLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/summarize`, {
        document_source: sumDoc,
        style: targetStyle
      });
      if (res.data.success) {
        setSummaryResult(res.data);
      } else {
        alert('Lỗi khi tóm tắt: ' + res.data.text);
      }
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSumLoading(false);
    }
  };

  // Quiz Score Calculation
  const calculateScore = () => {
    if (!quizData) return { correct: 0, total: 0, score10: 0 };
    let correct = 0;
    quizData.forEach((q, idx) => {
      if (userAnswers[idx] === q.correct_answer) correct++;
    });
    const total = quizData.length;
    const score10 = total > 0 ? ((correct / total) * 10).toFixed(1) : 0;
    return { correct, total, score10 };
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-sm">
        <div className="p-5 overflow-y-auto">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight">SmartStudy RAG</h1>
              <p className="text-xs text-slate-500">Local LLM & Trí tuệ Nhân tạo</p>
            </div>
          </div>

          {/* New Chat Button (DeepSeek / ChatGPT Sidebar Style) */}
          <button
            onClick={() => {
              setActiveTab('chat');
              handleNewChat();
            }}
            className="w-full mb-5 py-2.5 px-3.5 rounded-xl border border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/70 text-slate-800 hover:text-blue-700 font-semibold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Plus className="w-4 h-4" />
              </span>
              <span>Cuộc trò chuyện mới</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50 group-hover:border-blue-200">
              New
            </span>
          </button>

          {/* Model Status Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mô hình AI</span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                systemStatus?.is_fallback 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${systemStatus?.is_fallback ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                {systemStatus?.is_fallback ? 'Dự phòng' : 'Chính'}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {systemStatus?.active_model || 'Đang kết nối Ollama...'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>Embedding: {systemStatus?.embedding_model || 'nomic'}</span>
              <span>•</span>
              <span>{systemStatus?.total_chunks || 0} chunks</span>
            </div>
          </div>

          {/* Document Upload Area with Progress and Cancel */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tải lên Giáo trình / Slide</span>
            </div>

            {!uploading ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all border-slate-300 hover:border-blue-500 hover:bg-slate-50">
                <Upload className="w-6 h-6 mb-2 text-slate-400" />
                <span className="text-xs font-medium text-slate-700 text-center">
                  Chọn file PDF, DOCX, TXT
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">Tự động gắn số trang</span>
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf,.docx,.txt" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            ) : (
              <div className="border border-blue-200 bg-blue-50/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> Đang xử lý...
                  </span>
                  <span className="font-bold text-blue-700 font-mono">{uploadProgress}%</span>
                </div>

                {/* Thanh tiến trình % */}
                <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 truncate" title={uploadStep}>
                  {uploadStep || 'Đang phân tích dữ liệu...'}
                </p>

                {/* Nút Hủy tải lên */}
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="w-full py-1.5 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-all shadow-2xs"
                >
                  ✕ Hủy tải lên
                </button>
              </div>
            )}
          </div>

          {/* Indexed Documents List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tài liệu đã index ({documents.length})</span>
            </div>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có tài liệu nào trong ChromaDB.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs">
                    <div className="truncate mr-2">
                      <p className="font-medium text-slate-800 truncate" title={doc.source}>{doc.source}</p>
                      <p className="text-[11px] text-slate-500">{doc.total_pages} trang • {doc.chunks} đoạn</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteDoc(doc.source)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                      title="Xóa tài liệu"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scope Filter for Query */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
              Phạm vi tìm kiếm
            </label>
            <select 
              value={selectedDocFilter}
              onChange={(e) => setSelectedDocFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Tất cả tài liệu">Toàn bộ kho tài liệu</option>
              {documents.map((d, i) => (
                <option key={i} value={d.source}>{d.source}</option>
              ))}
            </select>
          </div>
        </div>

        {/* User / Team Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Nhóm 23CN4 • RAG EdTech</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">v1.0</span>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100/60">
        {/* Navigation Tabs Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'chat' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Hỏi đáp RAG
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'quiz' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4" /> Luyện thi Quiz
            </button>
            <button
              onClick={() => setActiveTab('flashcards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'flashcards' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" /> Flashcards
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'summary' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" /> Tóm tắt tài liệu
            </button>
            <button
              onClick={() => setActiveTab('arch')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'arch' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-4 h-4" /> Kiến trúc
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Local Inference Ready</span>
          </div>
        </header>

        {/* TAB 1: CHATBOT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-6 max-w-5xl mx-auto w-full">
            {/* Chat Context & Control Bar */}
            <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-200/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Bộ nhớ ngữ cảnh: {messages.filter(m => m.role === 'user').length} lượt hỏi • Tự lưu F5
                </span>
                {selectedDocFilter !== 'Tất cả tài liệu' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                    🔍 {selectedDocFilter}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Nút "Cuộc trò chuyện mới" ở menu bên trái</span>
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-2xl rounded-2xl p-4.5 text-sm shadow-xs ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-xs' 
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}>
                    {/* Message Content */}
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    ) : (
                      <RichContentRenderer text={msg.content} />
                    )}

                    {/* Citations / Sources Accordion */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100">
                        <button 
                          onClick={() => setOpenSources(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          <BookMarked className="w-3.5 h-3.5" />
                          <span>Trích dẫn nguồn ({msg.sources.length} vị trí tham chiếu)</span>
                          {openSources[idx] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {openSources[idx] && (
                          <div className="mt-2.5 space-y-2">
                            {msg.sources.map((src, sIdx) => (
                              <div key={sIdx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-700">
                                <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                                  <span>📄 {src.source} (Trang {src.page})</span>
                                  <span className="text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                                    {(src.score * 100).toFixed(1)}% match
                                  </span>
                                </div>
                                <p className="italic text-slate-500 text-[11px] leading-normal font-sans">
                                  "{src.snippet}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata Footer */}
                    {msg.latency && (
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <span>Model: {msg.modelUsed}</span>
                        <span>⚡ {msg.latency}s</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs p-4 text-xs text-slate-500 flex items-center gap-2.5 shadow-xs">
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                    <span>Đang tra cứu vector tương đồng và tổng hợp câu trả lời từ tài liệu...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendMessage} className="mt-4 shrink-0">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Hỏi bất kỳ điều gì dựa trên tài liệu đã tải lên (ví dụ: 'Nêu các bước trong giao thức TCP?')..."
                  disabled={chatLoading}
                  className="w-full bg-white border border-slate-300 rounded-2xl py-3.5 pl-4.5 pr-14 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !inputQuery.trim()}
                  className="absolute right-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-sm cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Hệ thống trả lời bám sát tài liệu với trích dẫn số trang • Lưu ngữ cảnh phiên gần nhất • Tránh bịa đặt thông tin
              </p>
            </form>
          </div>
        )}

        {/* TAB 2: QUIZ GENERATOR */}
        {activeTab === 'quiz' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" /> Tự động sinh Đề thi Trắc nghiệm Ôn tập
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                AI sẽ đọc tài liệu đã index và tạo bộ 4 đáp án A-B-C-D kèm đáp án đúng và lời giải thích chi tiết.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tài liệu làm đề</label>
                  <select 
                    value={quizDoc} 
                    onChange={(e) => setQuizDoc(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800"
                  >
                    {documents.map((d, i) => (
                      <option key={i} value={d.source}>{d.source}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Số lượng câu hỏi</label>
                  <select 
                    value={numQuestions} 
                    onChange={(e) => setNumQuestions(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800"
                  >
                    <option value={5}>5 câu hỏi tiêu chuẩn</option>
                    <option value={10}>10 câu hỏi tổng hợp</option>
                    <option value={15}>15 câu hỏi mở rộng</option>
                  </select>
                </div>
              </div>

              {/* 3 Thẻ độ khó chuyển đổi tức thì */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Độ khó đề thi</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'Dễ', label: '🟢 Dễ', desc: 'Định nghĩa & Khái niệm' },
                    { id: 'Trung bình', label: '🔵 Trung bình', desc: 'Thông hiểu & Phân tích' },
                    { id: 'Khó', label: '🔴 Khó', desc: 'Vận dụng nâng cao' }
                  ].map((diff) => (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() => {
                        setQuizDifficulty(diff.id);
                        if (quizDoc) {
                          handleGenerateQuiz(diff.id);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        quizDifficulty === diff.id
                          ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-bold shadow-2xs ring-1 ring-blue-400/50'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-semibold">{diff.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">{diff.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleGenerateQuiz()}
                disabled={quizLoading || documents.length === 0}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {quizLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {quizLoading ? 'Đang phân tích kiến thức và sinh đề thi...' : `🎲 Sinh đề trắc nghiệm (${quizDifficulty})`}
              </button>
            </div>

            {/* Quiz Questions Stepper Flow */}
            {quizData && quizData.length > 0 && (
              <div>
                {!quizSubmitted ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* KHỐI CÂU HỎI HIỆN TẠI (2 CỘT) */}
                    <div className="lg:col-span-2 space-y-4">
                      {/* Thanh tiến trình */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tiến trình làm bài</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm font-bold text-slate-800">
                              Câu {currentQuestionIdx + 1} / {quizData.length}
                            </p>
                            {quizMeta?.from_cache && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-3xs">
                                ⚡ Tức thì từ Cache ({quizMeta?.latency_sec}s)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-48 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full transition-all duration-300 rounded-full"
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
                          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                            <div className="flex items-start justify-between gap-3">
                              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold shrink-0">
                                CÂU {currentQuestionIdx + 1}
                              </span>
                              <h3 className="font-semibold text-slate-900 text-sm leading-relaxed flex-1">
                                {q.question}
                              </h3>
                            </div>

                            {/* 4 Lựa chọn A B C D */}
                            <div className="space-y-2.5">
                              {Object.entries(q.options || {}).map(([key, optText]) => {
                                const isSelected = currentSelected === key;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => setUserAnswers(prev => ({ ...prev, [currentQuestionIdx]: key }))}
                                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-xs text-left transition-all ${
                                      isSelected
                                        ? 'border-blue-600 bg-blue-50/90 text-blue-900 font-semibold shadow-xs ring-1 ring-blue-500'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {key}
                                    </span>
                                    <span className="leading-normal">{optText}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Nút Điều hướng Câu trước / Câu tiếp theo */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                              <button
                                type="button"
                                disabled={currentQuestionIdx === 0}
                                onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-1.5 transition-all"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" /> Câu trước
                              </button>

                              {currentQuestionIdx < quizData.length - 1 ? (
                                <button
                                  type="button"
                                  onClick={() => setCurrentQuestionIdx(prev => Math.min(quizData.length - 1, prev + 1))}
                                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                  Câu tiếp theo <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setQuizSubmitted(true)}
                                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                  Nộp bài & Chấm điểm 🎯
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* MA TRẬN ĐIỀU HƯỚNG CÂU HỎI BÊN CẠNH (1 CỘT) */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Danh sách câu hỏi</span>
                        <span className="text-[11px] text-slate-500 font-medium">
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
                              className={`h-9 rounded-lg font-bold text-xs transition-all flex items-center justify-center ${
                                isCurrent
                                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                                  : isAnswered
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setQuizSubmitted(true)}
                          className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-all text-center block"
                        >
                          Nộp bài ngay
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* BẢNG TỔNG KẾT KẾT QUẢ V XANH / X ĐỎ */
                  <div className="space-y-6">
                    {/* Bảng điểm tổng quan */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-md flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">Tổng kết bài làm</span>
                        <h3 className="text-2xl font-bold mt-1">
                          {calculateScore().correct} / {calculateScore().total} câu đúng • Điểm: {calculateScore().score10}/10
                        </h3>
                        <p className="text-xs text-blue-100 mt-1">
                          {Number(calculateScore().score10) >= 8.0 
                            ? 'Xuất sắc! Bạn đã nắm rất vững kiến thức tài liệu.' 
                            : 'Hãy xem lại các câu trả lời chi tiết bên dưới để ôn thi tốt hơn nhé!'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setQuizSubmitted(false); setUserAnswers({}); setCurrentQuestionIdx(0); }}
                        className="px-5 py-2.5 bg-white text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-50 shadow-sm transition-all"
                      >
                        Làm lại bài thi 🔄
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
                            className={`p-5 rounded-2xl border bg-white shadow-xs transition-all ${
                              isCorrect ? 'border-emerald-200' : 'border-rose-200'
                            }`}
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <span className={`p-1 rounded-full shrink-0 ${isCorrect ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                              </span>
                              <div className="flex-1">
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isCorrect ? 'Chính xác' : 'Chưa đúng'} • Câu {idx + 1}
                                </span>
                                <h4 className="font-semibold text-slate-900 text-sm mt-0.5">{q.question}</h4>
                              </div>
                            </div>

                            {/* Danh sách 4 đáp án */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-3 text-xs">
                              {Object.entries(q.options || {}).map(([key, optText]) => {
                                const isUserSelected = userChoice === key;
                                const isAnswerKey = q.correct_answer === key;
                                let style = 'border-slate-200 bg-slate-50 text-slate-700';

                                if (isAnswerKey) {
                                  style = 'border-emerald-400 bg-emerald-50/80 text-emerald-900 font-semibold ring-1 ring-emerald-400';
                                } else if (isUserSelected && !isCorrect) {
                                  style = 'border-rose-400 bg-rose-50/80 text-rose-900 font-medium line-through';
                                }

                                return (
                                  <div key={key} className={`p-2.5 rounded-xl border flex items-center gap-2 ${style}`}>
                                    <span className="font-bold">{key}.</span>
                                    <span>{optText}</span>
                                    {isAnswerKey && <span className="ml-auto text-[10px] text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded">Đáp án đúng</span>}
                                    {isUserSelected && !isCorrect && <span className="ml-auto text-[10px] text-rose-700 font-bold bg-white px-1.5 py-0.5 rounded">Bạn chọn</span>}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Lời giải thích */}
                            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                              <p className="font-semibold text-slate-800">
                                💡 Giải thích: <span className="font-normal text-slate-600">{q.explanation}</span>
                              </p>
                              {q.source_note && (
                                <p className="text-[11px] text-slate-500 mt-1">Khái niệm liên quan: {q.source_note}</p>
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
        )}

        {/* TAB 3: FLASHCARDS */}
        {activeTab === 'flashcards' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" /> Thẻ Ghi nhớ (Flashcards) Ôn tập Nhanh
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Hệ thống trích lọc các định nghĩa, thuật ngữ cốt lõi từ tài liệu để ghi nhớ trước kỳ thi.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tài liệu</label>
                  <select 
                    value={fcDoc} 
                    onChange={(e) => setFcDoc(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                  >
                    {documents.map((d, i) => (
                      <option key={i} value={d.source}>{d.source}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Số lượng thẻ</label>
                  <select 
                    value={numCards} 
                    onChange={(e) => setNumCards(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                  >
                    <option value={4}>4 thẻ</option>
                    <option value={6}>6 thẻ</option>
                    <option value={8}>8 thẻ</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateFlashcards}
                disabled={fcLoading || documents.length === 0}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {fcLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {fcLoading ? 'Đang chiết xuất các khái niệm cốt lõi...' : '🎴 Tạo bộ Flashcard ngay'}
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
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-blue-500 transition-all min-h-[160px] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-blue-600 font-semibold mb-2">
                          <span>Thẻ #{idx + 1} • {card.category || 'Khái niệm'}</span>
                          <span className="text-slate-400">Click để lật thẻ ↻</span>
                        </div>
                        <p className="font-bold text-slate-800 text-sm mb-2">{card.front}</p>
                        {isFlipped && (
                          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                            {card.back}
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-2">
                        {isFlipped ? '✅ Đã xem định nghĩa' : '🔍 Nhấn để xem lời giải'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUMMARIZER */}
        {activeTab === 'summary' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Tóm tắt Giáo trình & Đề cương Ôn thi
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Tự động chắt lọc kiến thức thành 3 phần: Tổng quan, Các khái niệm cốt lõi, và Ghi nhớ trọng tâm ôn thi.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tài liệu</label>
                  <select 
                    value={sumDoc} 
                    onChange={(e) => setSumDoc(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                  >
                    {documents.map((d, i) => (
                      <option key={i} value={d.source}>{d.source}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Cấp độ tóm tắt</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Cơ bản', label: '⚡ Cơ bản', desc: 'TL;DR 30s' },
                      { id: 'Trung bình', label: '📘 Trung bình', desc: 'Đề cương ôn tập' },
                      { id: 'Nâng cao', label: '🎓 Nâng cao', desc: 'Chuyên sâu' }
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => {
                          setSumStyle(lvl.id);
                          if (sumDoc) {
                            handleGenerateSummary(lvl.id);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          sumStyle === lvl.id
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-2xs ring-1 ring-indigo-400/50'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-semibold">{lvl.label}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{lvl.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleGenerateSummary()}
                disabled={sumLoading || documents.length === 0}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {sumLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {sumLoading ? 'Đang đọc và biên soạn bản tóm tắt...' : `✨ Tạo bản tóm tắt (${sumStyle})`}
              </button>
            </div>

            {summaryResult && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Bản Tóm Tắt Nội Dung: {sumDoc}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500">Mô hình: {summaryResult.model_used} • {summaryResult.latency_sec}s</p>
                      {summaryResult.from_cache && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          ⚡ Tức thì từ Cache
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải về (.txt)
                  </button>
                </div>
                <div className="text-sm text-slate-800 leading-relaxed font-sans pt-1">
                  <RichContentRenderer text={summaryResult.text} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ARCHITECTURE & SYSTEM */}
        {activeTab === 'arch' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" /> Sơ đồ Kiến trúc RAG Hệ thống Mới
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Kiến trúc tinh gọn gồm React + Tailwind CSS (Frontend), FastAPI (Backend), ChromaDB (Vector Store) và Ollama (Local LLM).
              </p>

              {/* Architecture Flow Boxes */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/80 font-mono text-xs text-slate-700 leading-relaxed overflow-x-auto">
                <pre>{`
    [Người dùng / Sinh viên]
               │
               ▼
   [REACT + TAILWIND CSS (Frontend)]
               │
               ▼ REST API
   [FASTAPI (Backend Orchestrator)]
        ┌──────┴──────┐
        ▼             ▼
  [Upload PDF]   [Truy vấn câu hỏi / Quiz]
        │             │
        ▼             ▼
  [PyMuPDF Chunks] [ChromaDB Vector Store] (Cosine Top-k)
        │             │
        └──────┬──────┘
               ▼ (Gộp Context + Prompt Tiếng Việt)
  [LOCAL LLM (Ollama - Qwen 2.5 7B / Dự phòng: Llama 3.1 8B)]
               │
               ▼
  1. Trả lời câu hỏi kèm trích dẫn số trang chính xác
  2. Tự động sinh trắc nghiệm A-B-C-D (JSON mode)
  3. Tóm tắt nội dung bài giảng
                `}</pre>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-4">Thông số Cấu hình & Phần cứng Thực tế</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block mb-1 font-semibold">Mô hình LLM chính</span>
                  <span className="font-bold text-slate-800 text-sm">Qwen 2.5 7B (Ollama)</span>
                  <p className="text-slate-500 mt-1">Tối ưu tiếng Việt, suy luận logic có cấu trúc</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block mb-1 font-semibold">Mô hình LLM dự phòng</span>
                  <span className="font-bold text-slate-800 text-sm">Llama 3.1 8B (Ollama)</span>
                  <p className="text-slate-500 mt-1">Tự động kích hoạt khi mô hình chính lỗi/timeout</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block mb-1 font-semibold">Mô hình Embedding</span>
                  <span className="font-bold text-slate-800 text-sm">nomic-embed-text (8192 context)</span>
                  <p className="text-slate-500 mt-1">Nhúng vector ngữ nghĩa độ chính xác cao</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block mb-1 font-semibold">Cơ sở dữ liệu Vector</span>
                  <span className="font-bold text-slate-800 text-sm">ChromaDB Cục bộ</span>
                  <p className="text-slate-500 mt-1">Lưu trữ trên đĩa cứng `./chroma_db`</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
