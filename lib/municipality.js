// Municipality configuration - reads from environment variables
// To add a new municipality: update .env.local with the new values

export const municipalityConfig = {
  name: process.env.NEXT_PUBLIC_MUNICIPALITY_NAME || 'עיריית יהוד-מונוסון',
  shortName: process.env.NEXT_PUBLIC_MUNICIPALITY_SHORT || 'יהוד-מונוסון',
  id: process.env.NEXT_PUBLIC_MUNICIPALITY_ID || 'yehud',
  logo: process.env.NEXT_PUBLIC_MUNICIPALITY_LOGO || '/images/yehud-logo.png',
  primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#7c3aed',
  systemName: process.env.NEXT_PUBLIC_SYSTEM_NAME || 'מקלטון',
  systemSubtitle: process.env.NEXT_PUBLIC_SYSTEM_SUBTITLE || 'מערכת ניהול אירועי חירום',
};

export function getMunicipalityId() {
  if (typeof window === 'undefined') return municipalityConfig.id;
  return localStorage.getItem('municipality_id') || municipalityConfig.id;
}

export function setMunicipalityId(id) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('municipality_id', id);
}

// Legacy - kept for backward compatibility
export async function fetchYehudId() {
  return municipalityConfig.id;
}
