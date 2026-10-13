import { useState, useEffect, useRef } from 'react';
import axios, { API_BASE } from '../api/client';

export function useDocuments({ onDocsLoaded, onDocDeleted } = {}) {
  const [systemStatus, setSystemStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocFilter, setSelectedDocFilter] = useState('Tất cả tài liệu');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const uploadAbortRef = useRef(null);

  const fetchStatusAndDocs = async () => {
    try {
      const [resStatus, resDocs] = await Promise.all([
        axios.get(`${API_BASE}/status`),
        axios.get(`${API_BASE}/documents`)
      ]);
      setSystemStatus(resStatus.data);
      setDocuments(resDocs.data);
      if (resDocs.data && resDocs.data.length > 0 && onDocsLoaded) {
        onDocsLoaded(resDocs.data);
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

  const handleCancelUpload = () => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadStep('');
  };

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
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        timeout: 180000
      });
      clearInterval(progressTimer);

      const failed = res.data?.details?.filter(d => d.status === 'error') || [];
      if (failed.length > 0) {
        const errorMsgs = failed.map(f => `• ${f.filename}: ${f.error}`).join('\n');
        alert(`Thông báo tải tài liệu:\n${errorMsgs}`);
      }

      setUploadProgress(100);
      setUploadStep(failed.length > 0 ? '⚠️ Hoàn tất có cảnh báo' : '✅ Hoàn tất!');
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

  const handleDeleteDoc = async (sourceName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${sourceName}"?\nHệ thống sẽ xóa toàn bộ vector, cache tóm tắt và cache đề thi tương ứng.`)) return;
    try {
      await axios.delete(`${API_BASE}/documents/${encodeURIComponent(sourceName)}`);
      if (onDocDeleted) {
        onDocDeleted(sourceName);
      }
      await fetchStatusAndDocs();
    } catch (err) {
      alert('Lỗi khi xóa tài liệu: ' + err.message);
    }
  };

  return {
    systemStatus,
    documents,
    selectedDocFilter,
    setSelectedDocFilter,
    uploading,
    uploadProgress,
    uploadStep,
    fetchStatusAndDocs,
    handleFileUpload,
    handleCancelUpload,
    handleDeleteDoc
  };
}
