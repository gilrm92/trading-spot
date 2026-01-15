// Generate and store a unique user ID in localStorage
export function getOrCreateUserId() {
  let userId = localStorage.getItem('tornUserId');
  
  if (!userId) {
    // Generate a unique ID
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tornUserId', userId);
  }
  
  return userId;
}
