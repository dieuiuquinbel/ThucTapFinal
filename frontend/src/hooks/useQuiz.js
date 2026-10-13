import { useState } from 'react';
import axios, { API_BASE } from '../api/client';

export function useQuiz({ currentUser, showAlert } = {}) {
  const [quizDoc, setQuizDoc] = useState(() => localStorage.getItem('smartstudy_quiz_doc') || '');
  const [numQuestions, setNumQuestions] = useState(() => Number(localStorage.getItem('smartstudy_quiz_count')) || 5);
  const [quizDifficulty, setQuizDifficulty] = useState(() => localStorage.getItem('smartstudy_quiz_diff') || 'Trung bình');
  const [quizData, setQuizData] = useState(null);
  const [quizMeta, setQuizMeta] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

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

  const handleGenerateQuiz = async (overrideDifficulty = null, overrideDoc = null, overrideCount = null, shufflePool = false) => {
    const targetDoc = (typeof overrideDoc === 'string' && overrideDoc.trim()) ? overrideDoc : quizDoc;
    if (!targetDoc) {
      if (showAlert) {
        showAlert({ title: 'Chưa chọn bài học 📖', message: 'Vui lòng chọn tài liệu học tập để sinh đề thi trắc nghiệm!', type: 'warning' });
      } else {
        alert('Vui lòng chọn tài liệu để sinh đề!');
      }
      return;
    }
    const targetDiff = (typeof overrideDifficulty === 'string' && overrideDifficulty.trim()) ? overrideDifficulty : quizDifficulty;
    const targetCount = (typeof overrideCount === 'number' && overrideCount > 0) ? overrideCount : Number(numQuestions);
    setQuizLoading(true);
    setQuizSubmitted(false);
    setUserAnswers({});
    setCurrentQuestionIdx(0);
    try {
      const res = await axios.post(`${API_BASE}/quiz`, {
        document_source: targetDoc,
        num_questions: targetCount,
        difficulty: targetDiff,
        shuffle: Boolean(shufflePool)
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setQuizData(res.data.data);
        setQuizMeta(res.data);
        setCurrentQuestionIdx(0);
      } else {
        if (showAlert) {
          showAlert({ title: 'Lỗi sinh đề thi ⚠️', message: 'Mô hình chưa thể sinh JSON trắc nghiệm. Vui lòng bấm thử lại!', type: 'warning' });
        } else {
          alert('Mô hình chưa thể sinh JSON trắc nghiệm. Vui lòng bấm thử lại!');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message;
      if (showAlert) {
        showAlert({ title: 'Lỗi kết nối ❌', message: 'Không thể tạo đề thi: ' + errMsg, type: 'error' });
      } else {
        alert('Lỗi: ' + errMsg);
      }
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizSubmitWithSave = async () => {
    setQuizSubmitted(true);
    const score = calculateScore();
    if (currentUser && quizDoc) {
      try {
        await axios.post(`${API_BASE}/user/quiz-score`, {
          document_source: quizDoc,
          score_10: Number(score.score10),
          correct_count: score.correct,
          total_questions: score.total,
          difficulty: quizDifficulty
        });
      } catch (e) {
        console.warn('Không thể lưu kết quả bài thi:', e);
      }
    }
  };

  return {
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
    handleGenerateQuiz,
    handleQuizSubmitWithSave,
    calculateScore
  };
}
