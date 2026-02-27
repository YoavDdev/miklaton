export function isRTL(text) {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;
  return rtlChars.test(text);
}

export function formatPhoneNumber(phone) {
  return phone.replace(/[^\d]/g, '');
}

export function getAccessibilityColor(accessibility) {
  switch (accessibility) {
    case 'נגיש':
      return 'bg-green-100 text-green-800';
    case 'לא נגיש':
      return 'bg-red-100 text-red-800';
    case 'לא ידוע':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
