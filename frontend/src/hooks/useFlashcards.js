import { useState } from 'react';
import axios, { API_BASE } from '../api/client';

export function useFlashcards({ showAlert } = {}) {
  const [fcDoc, setFcDoc] = useState(() => localStorage.getItem('smartstudy_fc_doc') || '');
  const [numCards, setNumCards] = useState(6);
  const [flashcards, setFlashcards] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [fcLoading, setFcLoading] = useState(false);

  const handleGenerateFlashcards = async (overrideDoc = null) => {
    const targetDoc = (typeof overrideDoc === 'string' && overrideDoc.trim()) ? overrideDoc : fcDoc;
    if (!targetDoc) {
      if (showAlert) {
        showAlert({ title: 'Chưa chọn bài học 🃏', message: 'Vui lòng chọn tài liệu để tạo bộ Thẻ ghi nhớ!', type: 'warning' });
      } else {
        alert('Vui lòng chọn tài liệu để tạo Thẻ ghi nhớ!');
      }
      return;
    }
    setFcLoading(true);
    setFlippedCards({});
    try {
      const res = await axios.post(`${API_BASE}/flashcards`, {
        document_source: targetDoc,
        num_cards: Number(numCards)
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setFlashcards(res.data.data);
      } else {
        if (showAlert) {
          showAlert({ title: 'Tạo thẻ chưa thành công ⚠️', message: 'Không thể tạo thẻ ghi nhớ từ tài liệu này. Vui lòng bấm thử lại!', type: 'warning' });
        } else {
          alert('Không thể tạo thẻ ghi nhớ. Vui lòng thử lại!');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message;
      if (showAlert) {
        showAlert({ title: 'Lỗi kết nối ❌', message: 'Không thể tạo thẻ ghi nhớ: ' + errMsg, type: 'error' });
      } else {
        alert('Lỗi: ' + errMsg);
      }
    } finally {
      setFcLoading(false);
    }
  };

  return {
    fcDoc,
    setFcDoc,
    numCards,
    setNumCards,
    flashcards,
    setFlashcards,
    flippedCards,
    setFlippedCards,
    fcLoading,
    handleGenerateFlashcards
  };
}
