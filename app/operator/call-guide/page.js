'use client';

import { useRouter } from 'next/navigation';
import CallGuide from '@/components/CallGuide';

export default function CallGuidePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
          >
            <span className="text-xl">→</span>
            <span className="font-semibold">חזרה</span>
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900">
            📋 מדריך פניות למוקדן
          </h1>
          
          <div className="w-24"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <CallGuide />
      </div>
    </div>
  );
}
