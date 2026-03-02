'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🛡️</div>
          <h1 className="text-3xl font-bold text-white">מקלטון</h1>
          <p className="text-gray-400 mt-2 text-sm">מערכת ניהול אירועי חירום — יהוד-מונוסון</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => router.push('/login')}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg rounded-xl transition-colors shadow-lg"
          >
            כניסה למערכת
          </button>

          <button
            onClick={() => router.push('/inspection')}
            className="w-full py-4 bg-white hover:bg-gray-100 text-gray-900 font-bold text-lg rounded-xl transition-colors shadow-lg flex items-center justify-center gap-3"
          >
            <span>🔍</span>
            סיור פקח
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-10">
          מוקד עירוני יהוד-מונוסון
        </p>
      </div>
    </div>
  );
}
