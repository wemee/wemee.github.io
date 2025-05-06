// 主頁面代碼 (main.js)
class AsyncPrimeGenerator {
  constructor() {
    // 創建Web Worker
    this.worker = new Worker('prime-worker.js');
    this.callbacks = {};
    this.callbackId = 0;

    // 監聽Worker的消息
    this.worker.onmessage = (event) => {
      const { id, result } = event.data;
      if (this.callbacks[id]) {
        this.callbacks[id](result);
        delete this.callbacks[id];
      }
    };
  }

  // 發送消息到Worker並返回Promise
  sendToWorker(action, params) {
    console.log('AsyncPrimeGenerator sendToWorker:')
    return new Promise((resolve) => {
      const id = this.callbackId++;
      this.callbacks[id] = resolve;
      this.worker.postMessage({ id, action, params });
    });
  }

  // 檢查一個數是否為質數
  async isPrime(n) {
    console.log('AsyncPrimeGenerator isPrime:'+n)
    return await this.sendToWorker('isPrime', { n: n.toString() });
  }

  // 獲取所有小於等於n的質數
  async getPrimesUpTo(n) {
    return await this.sendToWorker('getPrimesUpTo', { n: n.toString() });
  }

  // 終止Worker
  terminate() {
    this.worker.terminate();
  }
}
