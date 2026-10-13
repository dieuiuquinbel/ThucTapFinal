import React, { useState } from 'react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useDocuments } from './hooks/useDocuments';
import { useChat } from './hooks/useChat';
import { useQuiz } from './hooks/useQuiz';
import { useFlashcards } from './hooks/useFlashcards';
import { useSummary } from './hooks/useSummary';

// Layout & Modals
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import AuthModal from './components/modals/AuthModal';
import QuizHistoryModal from './components/modals/QuizHistoryModal';

// Features / Tabs
import ChatTab from './features/chat/ChatTab';
import QuizTab from './features/quiz/QuizTab';
import FlashcardsTab from './features/flashcards/FlashcardsTab';
import SummaryTab from './features/summary/SummaryTab';
import ArchTab from './features/architecture/ArchTab';
import GuidelinesTab from './features/guidelines/GuidelinesTab';

export default function App() {
  const [activeTab, setActiveTabState] = useState(() => {
    return localStorage.getItem('smartstudy_active_tab') || 'chat';
  });

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try { localStorage.setItem('smartstudy_active_tab', tab); } catch (_) {}
  };

  // 1. Quản lý Auth & Học viên
  const auth = useAuth();

  // 2. Nghiệp vụ Quiz
  const quiz = useQuiz({ currentUser: auth.currentUser });

  // 3. Nghiệp vụ Thẻ ghi nhớ (Flashcards)
  const flashcards = useFlashcards();

  // 4. Nghiệp vụ Sổ tay Tóm tắt
  const summary = useSummary();

  // 5. Quản lý Tài liệu & Upload
  const docs = useDocuments({
    onDocsLoaded: (loadedDocs) => {
      const availableSources = loadedDocs.map(d => d.source);
      const fallbackFirst = loadedDocs[0].source;

      quiz.setQuizDoc(prev => {
        if (prev && availableSources.includes(prev)) return prev;
        const saved = localStorage.getItem('smartstudy_quiz_doc');
        if (saved && availableSources.includes(saved)) return saved;
        return fallbackFirst;
      });

      flashcards.setFcDoc(prev => {
        if (prev && availableSources.includes(prev)) return prev;
        const saved = localStorage.getItem('smartstudy_fc_doc');
        if (saved && availableSources.includes(saved)) return saved;
        return fallbackFirst;
      });

      summary.setSumDoc(prev => {
        if (prev && availableSources.includes(prev)) return prev;
        const saved = localStorage.getItem('smartstudy_sum_doc');
        if (saved && availableSources.includes(saved)) return saved;
        return fallbackFirst;
      });
    },
    onDocDeleted: (sourceName) => {
      if (summary.sumDoc === sourceName) {
        summary.setSummaryResult(null);
      }
      if (quiz.quizDoc === sourceName) {
        quiz.setQuizData(null);
        quiz.setQuizMeta(null);
      }
    }
  });

  // 6. Nghiệp vụ Chat & Trợ lý AI
  const chat = useChat({
    selectedDocFilter: docs.selectedDocFilter,
    systemStatus: docs.systemStatus
  });

  return (
    <div className="flex h-screen bg-[#f0f7ff] overflow-hidden font-sans">
      {/* Cột trái: Balo tài liệu & Thông tin học viên */}
      <Sidebar
        systemStatus={docs.systemStatus}
        documents={docs.documents}
        selectedDocFilter={docs.selectedDocFilter}
        setSelectedDocFilter={docs.setSelectedDocFilter}
        uploading={docs.uploading}
        uploadProgress={docs.uploadProgress}
        uploadStep={docs.uploadStep}
        onFileUpload={docs.handleFileUpload}
        onCancelUpload={docs.handleCancelUpload}
        onDeleteDoc={docs.handleDeleteDoc}
        onNewChat={() => {
          setActiveTab('chat');
          chat.handleNewChat();
        }}
        currentUser={auth.currentUser}
        userMenuOpen={auth.userMenuOpen}
        setUserMenuOpen={auth.setUserMenuOpen}
        onOpenAuthModal={() => {
          auth.setAuthMode('login');
          auth.setAuthModalOpen(true);
        }}
        onLogout={auth.handleLogout}
        onFetchQuizHistory={auth.handleFetchQuizHistory}
        onNavigateGuidelines={() => setActiveTab('guidelines')}
      />

      {/* Vùng học tập trung tâm */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#f0f7ff]">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* 6 Tabs nghiệp vụ */}
        {activeTab === 'chat' && (
          <ChatTab
            messages={chat.messages}
            inputQuery={chat.inputQuery}
            setInputQuery={chat.setInputQuery}
            chatLoading={chat.chatLoading}
            selectedDocFilter={docs.selectedDocFilter}
            openSources={chat.openSources}
            setOpenSources={chat.setOpenSources}
            chatBottomRef={chat.chatBottomRef}
            onSendMessage={chat.handleSendMessage}
            onNewChat={chat.handleNewChat}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizTab
            quizDoc={quiz.quizDoc}
            setQuizDoc={quiz.setQuizDoc}
            numQuestions={quiz.numQuestions}
            setNumQuestions={quiz.setNumQuestions}
            quizDifficulty={quiz.quizDifficulty}
            setQuizDifficulty={quiz.setQuizDifficulty}
            quizData={quiz.quizData}
            setQuizData={quiz.setQuizData}
            quizMeta={quiz.quizMeta}
            setQuizMeta={quiz.setQuizMeta}
            currentQuestionIdx={quiz.currentQuestionIdx}
            setCurrentQuestionIdx={quiz.setCurrentQuestionIdx}
            userAnswers={quiz.userAnswers}
            setUserAnswers={quiz.setUserAnswers}
            quizSubmitted={quiz.quizSubmitted}
            setQuizSubmitted={quiz.setQuizSubmitted}
            quizLoading={quiz.quizLoading}
            documents={docs.documents}
            onGenerateQuiz={quiz.handleGenerateQuiz}
            onSubmitWithSave={quiz.handleQuizSubmitWithSave}
            calculateScore={quiz.calculateScore}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsTab
            fcDoc={flashcards.fcDoc}
            setFcDoc={flashcards.setFcDoc}
            numCards={flashcards.numCards}
            setNumCards={flashcards.setNumCards}
            flashcards={flashcards.flashcards}
            setFlashcards={flashcards.setFlashcards}
            flippedCards={flashcards.flippedCards}
            setFlippedCards={flashcards.setFlippedCards}
            fcLoading={flashcards.fcLoading}
            documents={docs.documents}
            onGenerateFlashcards={flashcards.handleGenerateFlashcards}
          />
        )}

        {activeTab === 'summary' && (
          <SummaryTab
            sumDoc={summary.sumDoc}
            setSumDoc={summary.setSumDoc}
            sumStyle={summary.sumStyle}
            setSumStyle={summary.setSumStyle}
            summaryResult={summary.summaryResult}
            setSummaryResult={summary.setSummaryResult}
            sumLoading={summary.sumLoading}
            documents={docs.documents}
            onGenerateSummary={summary.handleGenerateSummary}
          />
        )}

        {activeTab === 'arch' && <ArchTab />}

        {activeTab === 'guidelines' && <GuidelinesTab />}
      </main>

      {/* Cửa sổ Modal Đăng nhập / Đăng ký / Xác thực */}
      <AuthModal
        isOpen={auth.authModalOpen}
        onClose={() => auth.setAuthModalOpen(false)}
        authMode={auth.authMode}
        setAuthMode={auth.setAuthMode}
        authForm={auth.authForm}
        setAuthForm={auth.setAuthForm}
        authLoading={auth.authLoading}
        devOtpHit={auth.devOtpHit}
        setDevOtpHit={auth.setDevOtpHit}
        onSubmit={auth.handleAuthSubmit}
      />

      {/* Cửa sổ Modal Lịch sử điểm thi Quiz */}
      <QuizHistoryModal
        isOpen={auth.quizHistoryModalOpen}
        onClose={() => auth.setQuizHistoryModalOpen(false)}
        currentUser={auth.currentUser}
        quizHistoryList={auth.quizHistoryList}
      />
    </div>
  );
}
