let container: HTMLDivElement | null = null;

export function showToast(message: string, duration = 2000) {
  if (!container) {
    container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.right = '16px';
    container.style.bottom = '16px';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.textContent = message;
  el.style.marginTop = '8px';
  el.style.background = 'rgba(0,0,0,0.8)';
  el.style.color = 'white';
  el.style.padding = '10px 14px';
  el.style.borderRadius = '10px';
  el.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
  el.style.fontSize = '14px';
  container.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity 300ms';
    el.style.opacity = '0';
    setTimeout(() => {
      container?.removeChild(el);
    }, 300);
  }, duration);
}
