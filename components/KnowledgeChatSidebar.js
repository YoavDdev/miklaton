'use client';

import { useState } from 'react';
import KnowledgeChat from '@/components/KnowledgeChat';

export default function KnowledgeChatSidebar({ userName = 'מוקדן' }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button - Bottom Left */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          title="מאגר ידע AI"
        >
          <span className="text-2xl">🧠</span>
        </button>
      )}

      {/* Sidebar Panel - Left Side */}
      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 w-[380px] h-[550px] rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-3 left-3 z-10 bg-white/20 hover:bg-white/30 text-white w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm"
          >
            ✕
          </button>
          <KnowledgeChat userName={userName} />
        </div>
      )}
    </>
  );
}
