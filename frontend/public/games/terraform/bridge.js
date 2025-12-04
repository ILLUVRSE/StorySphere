export class Bridge {
  constructor() {
    this.handlers = {};
    window.addEventListener('message', (e) => {
      if (this.handlers[e.data.type]) {
        this.handlers[e.data.type](e.data.payload);
      }
    });
  }

  send(type, payload) {
    if (window.parent) {
      window.parent.postMessage({ type, payload }, '*');
    }
  }

  on(type, handler) {
    this.handlers[type] = handler;
  }
}
