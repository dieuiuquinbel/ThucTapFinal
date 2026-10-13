import React from 'react';
import { MessageSquare, Award, Layers, FileText, BookOpen, Cpu } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'chat', label: 'Hỏi đáp bài học', icon: MessageSquare, color: 'text-sky-600', activeBg: 'bg-sky-500 text-white shadow-sky-300/50' },
    { id: 'quiz', label: 'Đấu trường Quiz', icon: Award, color: 'text-amber-500', activeBg: 'bg-amber-500 text-white shadow-amber-300/50' },
    { id: 'flashcards', label: 'Thẻ ghi nhớ', icon: Layers, color: 'text-emerald-500', activeBg: 'bg-emerald-500 text-white shadow-emerald-300/50' },
    { id: 'summary', label: 'Sổ tay tóm tắt', icon: FileText, color: 'text-purple-500', activeBg: 'bg-purple-500 text-white shadow-purple-300/50' },
    { id: 'guidelines', label: 'Nguyên tắc học', icon: BookOpen, color: 'text-blue-500', activeBg: 'bg-blue-600 text-white shadow-blue-300/50' },
    { id: 'arch', label: 'Hệ thống AI', icon: Cpu, color: 'text-slate-500', activeBg: 'bg-slate-700 text-white shadow-slate-300/50' }
  ];

  return (
    <header className="bg-white border-b border-sky-100 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs z-10">
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {tabs.map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive 
                  ? `${tab.activeBg} shadow-md scale-102` 
                  : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50/80'
              }`}
            >
              <IconComp className={`w-4 h-4 ${isActive ? 'text-white' : tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Học tập Offline</span>
        </div>
      </div>
    </header>
  );
}
