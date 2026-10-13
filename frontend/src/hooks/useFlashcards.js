import { useState } from 'react';
import axios, { API_BASE } from '../api/client';

export function useFlashcards() {
  const [fcDoc, setFcDoc] = useState(() => localStorage.getItem('smartstudy_fc_doc') || '');
  const [numCards, setNumCards] = useState(6);
  const [flashcards, setFlashcards] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [fcLoading, setFcLoading] = useState(false);

  const handleGenerateFlashcards = async (overrideDoc = null) => {
    const targetDoc = (typeof overrideDoc === 'string' && overrideDoc.trim()) ? overrideDoc : fcDoc;
    if (!targetDoc) {
      alert('Vui lòng chọn tài liệu để tạo Thẻ ghi nhớ!');
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
        alert('Không thể tạo thẻ ghi nhớ. Vui lòng thử lại!');
      }
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
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
