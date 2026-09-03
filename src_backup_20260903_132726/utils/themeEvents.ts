type ThemeListener = () => void;

class ThemeEventBus {
  private listeners: Set<ThemeListener> = new Set();
  
  subscribe(listener: ThemeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  emit() {
    this.listeners.forEach(l => {
      try { l(); } catch (e) { /* ignore */ }
    });
  }
}

export const themeEventBus = new ThemeEventBus();
