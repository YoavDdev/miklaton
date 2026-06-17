// Helper functions for municipality management

export async function fetchYehudId() {
  try {
    const response = await fetch('/api/municipalities/yehud');
    const data = await response.json();
    if (data.success && data.id) {
      return data.id;
    }
  } catch (error) {
    console.error('Error fetching Yehud ID:', error);
  }
  return null;
}

export function getMunicipalityId() {
  if (typeof window === 'undefined') return null;
  
  // Try to get from localStorage
  let municipalityId = localStorage.getItem('municipality_id');
  
  // If not set, we'll need to fetch it
  if (!municipalityId) {
    // Return null for now, component will handle fetching
    return null;
  }
  
  return municipalityId;
}

export function setMunicipalityId(id) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('municipality_id', id);
}
