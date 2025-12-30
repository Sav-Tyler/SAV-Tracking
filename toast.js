// toast.js - Auto-closing notification system

export function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #020617;
    color: #e5e7eb;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #1f2937;
    font-size: 13px;
    max-width: 300px;
    z-index: 9999;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
    font-weight: 500;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  if (duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  return toast;
}

// Add CSS animations globally
if (!document.querySelector('style[data-toast-styles]')) {
  const style = document.createElement('style');
  style.setAttribute('data-toast-styles', 'true');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
