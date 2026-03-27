export default function EditShiftModal({ 
  show, 
  shift, 
  editShift, 
  setEditShift, 
  contacts, 
  departments,
  onUpdate,
  onDelete,
  onClose 
}) {
  if (!show || !shift) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-gray-900">עריכת כוננות</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">איש קשר *</label>
            <select
              value={editShift.contact_id}
              onChange={(e) => setEditShift({...editShift, contact_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
            >
              <option value="">בחר איש קשר</option>
              {contacts.map(contact => (
                <option key={contact.id} value={contact.id}>{contact.full_name} - {contact.role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">מכלול *</label>
            <select
              value={editShift.department_id}
              onChange={(e) => setEditShift({...editShift, department_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
            >
              <option value="">בחר מכלול</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">יום בשבוע *</label>
            <select
              value={editShift.day_of_week}
              onChange={(e) => setEditShift({...editShift, day_of_week: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
            >
              <option value="0">ראשון</option>
              <option value="1">שני</option>
              <option value="2">שלישי</option>
              <option value="3">רביעי</option>
              <option value="4">חמישי</option>
              <option value="5">שישי</option>
              <option value="6">שבת</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">שעת התחלה</label>
              <select
                value={editShift.start_hour}
                onChange={(e) => setEditShift({...editShift, start_hour: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
              >
                {[...Array(24)].map((_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">שעת סיום</label>
              <select
                value={editShift.end_hour}
                onChange={(e) => setEditShift({...editShift, end_hour: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
              >
                {[...Array(24)].map((_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">הערות</label>
            <textarea
              value={editShift.notes}
              onChange={(e) => setEditShift({...editShift, notes: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
              placeholder="הערות נוספות..."
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex gap-3">
              <button
                onClick={onUpdate}
                className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 font-medium"
              >
                ✅ שמור שינויים
              </button>
              <button
                onClick={() => onDelete(shift.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
              >
                🗑️ מחק
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
