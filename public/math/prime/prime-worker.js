// Web Worker 代碼 (prime-worker.js)
class PrimeGenerator {
  constructor() {
    // 初始化質數列表，包含2和3
    this.primes = [BigInt(2), BigInt(3)];
    this.maxChecked = BigInt(3);
  }

  extendTo(n) {
    n = BigInt(n);
    if (n <= this.maxChecked) return;

    let start = this.maxChecked + BigInt(2);
    // if (start % BigInt(2) === BigInt(0)) start += BigInt(1);

    for (let i = start; i <= n; i += BigInt(2)) {
      let isPrime = true;
      const sqrt = this.sqrtNewton(i);

      for (let j = 0; j < this.primes.length && this.primes[j] <= sqrt; j++) {
        if (i % this.primes[j] === BigInt(0)) {
          isPrime = false;
          break;
        }
      }

      if (isPrime) {
        this.primes.push(i);
      }

      // 每處理一定數量的數字後，檢查是否需要暫停計算
      // if ((i - start) % BigInt(1000) === BigInt(0)) {
      //   self.postMessage({ type: 'progress', current: i.toString(), target: n.toString() });
      // }
    }

    this.maxChecked = n;
  }

  /**
  * 使用牛頓法計算 BigInt 的平方根（整數部分）
  * @param {BigInt} n - 要計算平方根的 BigInt 數值
  * @returns {BigInt} - n 的平方根（向下取整到整數）
  */
  sqrtNewton(n) {
    // 確保輸入是 BigInt 並且是非負數
    if (typeof n !== 'bigint' || n < 0n) {
      throw new Error('輸入必須是非負的 BigInt');
    }

    // 處理特殊情況
    if (n <= 3n) return 1n;

    // 初始猜測值
    let x = n;
    let y = (x + n / x) / 2n;

    // 牛頓法迭代，當 y >= x 時停止
    while (y < x) {
      x = y;
      y = (x + n / x) / 2n;
    }

    // 確保結果是正確的整數平方根
    while (x * x > n) {
      x = x - 1n;
    }

    return x;
  }

  isPrime(n) {
    n = BigInt(n);

    if (n < BigInt(2)) return false;
    if (n === BigInt(2) || n === BigInt(3)) return true;
    if (n % BigInt(2) === BigInt(0)) return false;

    console.log('start')
    this.extendTo(n);
    console.log(this.primes)

    // 檢查n是否在質數列表中
    return this.primes.includes(n)
    // return this.primes.some(p => p === n);
  }

  getPrimesUpTo(n) {
    n = BigInt(n);
    this.extendTo(n);
    return this.primes.filter(p => p <= n).map(p => p.toString());
  }
}

// 初始化生成器
const generator = new PrimeGenerator();

// 監聽主線程消息
self.onmessage = function(event) {
  console.log('onmessage')
  const { id, action, params } = event.data;
  let result;

  try {
    switch (action) {
      case 'isPrime':
        result = generator.isPrime(params.n);
        break;
      case 'getPrimesUpTo':
        result = generator.getPrimesUpTo(params.n);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // 發送結果回主線程
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};




////

var primes = [2, 3];
var check = 3;
var running = false;
var batchSize = 100000; // 每次生成的質數數量

function genPrimeBatch() {
  let count = 0;
  while (count < batchSize) {
    check += 2;
    let sqrt = Math.ceil(Math.sqrt(check));
    let isPrime = true;
    for (let i of primes) {
      if (check % i === 0) {
        isPrime = false;
        break;
      }
      if (i >= sqrt) break;
    }
    if (isPrime) {
      primes.push(check);
      count++;
    }
  }
  if (running) {
    setTimeout(genPrimeBatch, 0); // 繼續下一批
  }
}

function start() {
  running = true;
  genPrimeBatch(); // 開始生成質數
}

function stop() {
  running = false; // 停止生成質數
}
