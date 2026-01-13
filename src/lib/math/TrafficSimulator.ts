/**
 * 交通流體力學模擬器
 * 使用 IDM (Intelligent Driver Model) 跟車模型
 * 展示幽靈塞車與交通波吸收的概念
 */

// ========== 型別定義 ==========

export type VehicleType = 'normal' | 'disruptor' | 'absorber';
export type SimulatorState = 'idle' | 'running' | 'paused';

export interface Vehicle {
  id: number;
  type: VehicleType;
  position: number;       // 角度 [0, 2π)，逆時針方向
  velocity: number;       // rad/s
  acceleration: number;
  // IDM 參數
  desiredVelocity: number;
  safeTimeHeadway: number;
  maxAcceleration: number;
  comfortDecel: number;
  minGap: number;
  // 隨機減速參數 (Nagel-Schreckenberg)
  randomSlowdownProb: number;     // 隨機減速機率 (0-1)
  // 反應時間延遲
  reactionTime: number;           // 反應時間 (秒)
  leaderHistory: { gap: number; velocity: number; time: number }[];  // 前車狀態歷史
  // 擾動者專用
  nextDisruptionTime?: number;
  disruptionEndTime?: number;     // 擾動結束時間
  disruptionAction?: 'brake' | 'surge';  // 當前擾動類型
  disruptionTendency?: 'brake' | 'surge';  // 擾動傾向（生成時決定）
  // 視覺化
  typeColor: string;
}

export interface SimulationConfig {
  totalVehicles: number;
  normalRatio: number;
  disruptorRatio: number;
  absorberRatio: number;
  trackRadius: number;
  baseDesiredVelocity: number;
  disruptionFrequency: number;
  disruptionStrength: number;
  timeScale: number;
}

export interface SimulationStats {
  time: number;
  averageVelocity: number;
  velocityStdDev: number;
  velocityHistory: number[];
}

export type OnStatsUpdate = (stats: SimulationStats) => void;
export type OnStateChange = (state: SimulatorState) => void;

// ========== 車輛參數預設值 ==========

const VEHICLE_PARAMS = {
  normal: {
    desiredVelocityMult: 1.0,
    safeTimeHeadway: 1.5,
    maxAcceleration: 1.0,
    comfortDecel: 1.5,
    minGap: 0.08,
    randomSlowdownProb: 0.1,   // 10% 機率隨機減速
    reactionTime: 0.5,          // 0.5 秒反應時間
    color: '#2ecc71'  // 綠色
  },
  disruptor: {
    desiredVelocityMult: 1.1,
    safeTimeHeadway: 1.0,
    maxAcceleration: 1.5,
    comfortDecel: 2.5,
    minGap: 0.05,
    randomSlowdownProb: 0.15,  // 15% 機率隨機減速（較不穩定）
    reactionTime: 0.3,          // 0.3 秒反應時間（較激進）
    color: '#e74c3c'  // 紅色
  },
  absorber: {
    desiredVelocityMult: 0.9,
    safeTimeHeadway: 2.5,
    maxAcceleration: 0.6,
    comfortDecel: 1.0,
    minGap: 0.12,
    randomSlowdownProb: 0.05,  // 5% 機率隨機減速（較穩定）
    reactionTime: 0.8,          // 0.8 秒反應時間（較保守）
    color: '#3498db'  // 藍色
  }
};

// ========== 主類別 ==========

export class TrafficSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private centerX: number = 0;
  private centerY: number = 0;

  // 狀態
  private state: SimulatorState = 'idle';
  private vehicles: Vehicle[] = [];
  private config!: SimulationConfig;
  private stats: SimulationStats;

  // 時間控制
  private lastTimestamp: number = 0;
  private simulationTime: number = 0;
  private animationId: number | null = null;

  // 歷史記錄
  private readonly HISTORY_LENGTH = 200;
  private historyCanvas: HTMLCanvasElement | null = null;
  private historyCtx: CanvasRenderingContext2D | null = null;

  // 回調
  private onStatsUpdate: OnStatsUpdate | null = null;
  private onStateChange: OnStateChange | null = null;

  // 事件處理器
  private boundHandleResize: () => void;

  constructor(
    canvasId: string,
    callbacks?: {
      onStatsUpdate?: OnStatsUpdate;
      onStateChange?: OnStateChange;
    }
  ) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas with id ${canvasId} not found`);

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.onStatsUpdate = callbacks?.onStatsUpdate || null;
    this.onStateChange = callbacks?.onStateChange || null;

    this.stats = {
      time: 0,
      averageVelocity: 0,
      velocityStdDev: 0,
      velocityHistory: []
    };

    this.boundHandleResize = () => {
      this.setupCanvas();
      this.render();
    };

    window.addEventListener('resize', this.boundHandleResize);
    this.setupCanvas();
  }

  // ========== 公開方法 ==========

  public init(config: SimulationConfig): void {
    this.config = { ...config };
    this.simulationTime = 0;
    this.stats = {
      time: 0,
      averageVelocity: 0,
      velocityStdDev: 0,
      velocityHistory: []
    };
    this.spawnVehicles();
    this.state = 'idle';
    this.onStateChange?.(this.state);
    this.render();
  }

  public start(): void {
    if (this.state === 'running') return;
    this.state = 'running';
    this.lastTimestamp = performance.now();
    this.onStateChange?.(this.state);
    this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  public pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.onStateChange?.(this.state);
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.lastTimestamp = performance.now();
    this.onStateChange?.(this.state);
    this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  public reset(): void {
    this.pause();
    this.init(this.config);
  }

  public updateConfig(key: keyof SimulationConfig, value: number): void {
    (this.config as Record<string, number>)[key] = value;

    // 如果改變車輛數量或比例，需要重新生成
    if (['totalVehicles', 'normalRatio', 'disruptorRatio', 'absorberRatio'].includes(key)) {
      this.spawnVehicles();
    }
  }

  public setTimeScale(scale: number): void {
    this.config.timeScale = scale;
  }

  public getState(): SimulatorState {
    return this.state;
  }

  public getStats(): SimulationStats {
    return { ...this.stats };
  }

  public setHistoryCanvas(canvasId: string): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      this.historyCanvas = canvas;
      this.historyCtx = canvas.getContext('2d');
    }
  }

  public destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.boundHandleResize);
  }

  // ========== 私有方法：Canvas 設定 ==========

  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);

    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
  }

  // ========== 私有方法：車輛生成 ==========

  private spawnVehicles(): void {
    this.vehicles = [];
    const total = this.config.totalVehicles;

    // 計算各類型數量
    const totalRatio = this.config.normalRatio + this.config.disruptorRatio + this.config.absorberRatio;
    const normalCount = Math.round(total * (this.config.normalRatio / totalRatio));
    const disruptorCount = Math.round(total * (this.config.disruptorRatio / totalRatio));
    const absorberCount = total - normalCount - disruptorCount;

    // 建立車輛類型陣列
    const types: VehicleType[] = [
      ...Array(normalCount).fill('normal'),
      ...Array(disruptorCount).fill('disruptor'),
      ...Array(absorberCount).fill('absorber')
    ];

    // 打亂順序
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    // 均勻分布在環形軌道上
    const angleStep = (2 * Math.PI) / total;
    for (let i = 0; i < total; i++) {
      const type = types[i];
      const params = VEHICLE_PARAMS[type];

      this.vehicles.push({
        id: i,
        type,
        position: i * angleStep,
        velocity: this.config.baseDesiredVelocity * params.desiredVelocityMult,
        acceleration: 0,
        desiredVelocity: this.config.baseDesiredVelocity * params.desiredVelocityMult,
        safeTimeHeadway: params.safeTimeHeadway,
        maxAcceleration: params.maxAcceleration,
        comfortDecel: params.comfortDecel,
        minGap: params.minGap,
        // 隨機減速與反應時間（加入 ±20% 的個體差異）
        randomSlowdownProb: params.randomSlowdownProb * (0.8 + Math.random() * 0.4),
        reactionTime: params.reactionTime * (0.8 + Math.random() * 0.4),
        leaderHistory: [],
        typeColor: params.color,
        nextDisruptionTime: type === 'disruptor'
          ? Math.random() * (1 / this.config.disruptionFrequency)
          : undefined,
        disruptionTendency: type === 'disruptor'
          ? (Math.random() < 0.5 ? 'brake' : undefined)
          : undefined
      });
    }
  }

  // ========== 私有方法：物理模型 ==========

  private getLeader(vehicle: Vehicle): Vehicle {
    // 找到前方最近的車輛（逆時針方向前進）
    let minDist = Infinity;
    let leader = vehicle;

    for (const other of this.vehicles) {
      if (other.id === vehicle.id) continue;

      // 計算角度差（other 在 vehicle 前方的距離）
      let angleDiff = other.position - vehicle.position;
      if (angleDiff <= 0) angleDiff += 2 * Math.PI;

      if (angleDiff < minDist) {
        minDist = angleDiff;
        leader = other;
      }
    }

    return leader;
  }

  private getGap(follower: Vehicle, leader: Vehicle): number {
    let gap = leader.position - follower.position;
    if (gap <= 0) gap += 2 * Math.PI;
    return gap;
  }

  /** 記錄前車狀態到歷史（用於反應時間延遲） */
  private recordLeaderState(vehicle: Vehicle, leader: Vehicle): void {
    const gap = this.getGap(vehicle, leader);
    const state = {
      gap,
      velocity: leader.velocity,
      time: this.simulationTime
    };

    vehicle.leaderHistory.push(state);

    // 只保留最近 2 秒的歷史
    const maxHistoryTime = 2.0;
    while (
      vehicle.leaderHistory.length > 0 &&
      this.simulationTime - vehicle.leaderHistory[0].time > maxHistoryTime
    ) {
      vehicle.leaderHistory.shift();
    }
  }

  /** 獲取延遲後的前車狀態（反應時間延遲） */
  private getDelayedLeaderState(vehicle: Vehicle, leader: Vehicle): { gap: number; velocity: number } {
    const targetTime = this.simulationTime - vehicle.reactionTime;

    // 找到最接近目標時間的歷史記錄
    for (let i = vehicle.leaderHistory.length - 1; i >= 0; i--) {
      if (vehicle.leaderHistory[i].time <= targetTime) {
        return vehicle.leaderHistory[i];
      }
    }

    // 如果沒有足夠的歷史，使用當前狀態
    return {
      gap: this.getGap(vehicle, leader),
      velocity: leader.velocity
    };
  }

  private calculateIDMAcceleration(vehicle: Vehicle, leader: Vehicle): number {
    const v = vehicle.velocity;
    const v0 = this.getEffectiveDesiredVelocity(vehicle); // 使用動態期望速度

    // 使用延遲後的前車狀態（反應時間）
    const delayedState = this.getDelayedLeaderState(vehicle, leader);
    const s = delayedState.gap;
    const deltaV = v - delayedState.velocity;

    const s0 = vehicle.minGap;
    const T = vehicle.safeTimeHeadway;
    const a = vehicle.maxAcceleration;
    const b = vehicle.comfortDecel;

    // IDM 公式
    const sStar = s0 + Math.max(0, v * T + (v * deltaV) / (2 * Math.sqrt(a * b)));
    const acceleration = a * (1 - Math.pow(v / v0, 4) - Math.pow(sStar / s, 2));

    // 限制加速度範圍
    return Math.max(-b * 2, Math.min(a, acceleration));
  }

  private updateDisruptor(vehicle: Vehicle, dt: number): void {
    if (vehicle.type !== 'disruptor' || vehicle.nextDisruptionTime === undefined) return;

    // 檢查是否該開始新的擾動
    if (this.simulationTime >= vehicle.nextDisruptionTime && !vehicle.disruptionAction) {
      // 決定擾動類型
      if (vehicle.disruptionTendency === 'brake') {
        // 急煞型：只會急煞
        vehicle.disruptionAction = 'brake';
      } else {
        // 無傾向：隨機（50% 急煞、50% 爆衝）
        vehicle.disruptionAction = Math.random() < 0.5 ? 'brake' : 'surge';
      }
      // 擾動持續 0.5 ~ 1.5 秒
      const duration = 0.5 + Math.random() * this.config.disruptionStrength;
      vehicle.disruptionEndTime = this.simulationTime + duration;

      // 設定下次擾動時間
      const baseInterval = 1 / this.config.disruptionFrequency;
      vehicle.nextDisruptionTime = this.simulationTime + baseInterval * (0.8 + Math.random() * 0.4) + duration;
    }

    // 檢查擾動是否結束
    if (vehicle.disruptionEndTime && this.simulationTime >= vehicle.disruptionEndTime) {
      vehicle.disruptionAction = undefined;
      vehicle.disruptionEndTime = undefined;
    }
  }

  /** 檢查車輛是否正在急煞中，並返回強制加速度（爆衝不強制，改用 IDM） */
  private getDisruptionAcceleration(vehicle: Vehicle): number | null {
    if (!vehicle.disruptionAction) return null;

    if (vehicle.disruptionAction === 'brake') {
      // 急煞：強制減速，忽略 IDM
      const strength = this.config.disruptionStrength;
      return -vehicle.comfortDecel * (1.5 + strength * 2);
    }
    // 爆衝：不強制，交給 IDM 處理（但會提高期望速度）
    return null;
  }

  /** 取得車輛當前的期望速度（爆衝時提高） */
  private getEffectiveDesiredVelocity(vehicle: Vehicle): number {
    if (vehicle.disruptionAction === 'surge') {
      // 爆衝：期望速度提高 50%
      return vehicle.desiredVelocity * (1.3 + this.config.disruptionStrength * 0.5);
    }
    return vehicle.desiredVelocity;
  }

  private update(dt: number): void {
    // 更新擾動者狀態
    for (const vehicle of this.vehicles) {
      this.updateDisruptor(vehicle, dt);
    }

    // 記錄所有車輛的前車狀態（用於反應時間延遲）
    for (const vehicle of this.vehicles) {
      const leader = this.getLeader(vehicle);
      this.recordLeaderState(vehicle, leader);
    }

    // 計算所有車輛的加速度
    for (const vehicle of this.vehicles) {
      // 先檢查是否在擾動中
      const disruptionAcc = this.getDisruptionAcceleration(vehicle);
      if (disruptionAcc !== null) {
        // 擾動中：使用強制加速度
        vehicle.acceleration = disruptionAcc;
      } else {
        // 正常：使用 IDM
        const leader = this.getLeader(vehicle);
        vehicle.acceleration = this.calculateIDMAcceleration(vehicle, leader);

        // 隨機減速（Nagel-Schreckenberg 風格）
        // 只在車輛正在移動時才可能減速，避免靜止時觸發
        if (vehicle.velocity > 0.01 && Math.random() < vehicle.randomSlowdownProb * dt * 10) {
          // 減速量：0.5 ~ 1.5 倍的舒適減速度
          const randomDecel = vehicle.comfortDecel * (0.5 + Math.random());
          vehicle.acceleration -= randomDecel;
        }
      }
    }

    // 更新速度和位置
    for (const vehicle of this.vehicles) {
      vehicle.velocity += vehicle.acceleration * dt;
      vehicle.velocity = Math.max(0, vehicle.velocity); // 不能倒車
      // 限制最大速度
      vehicle.velocity = Math.min(vehicle.velocity, vehicle.desiredVelocity * 1.5);

      vehicle.position += vehicle.velocity * dt;
      // 環形軌道，位置循環
      while (vehicle.position >= 2 * Math.PI) {
        vehicle.position -= 2 * Math.PI;
      }
    }

    // 碰撞檢測與處理
    this.handleCollisions();

    this.simulationTime += dt;
    this.updateStats();
  }

  /** 碰撞檢測：若後車過於接近前車，漸進減速並推回 */
  private handleCollisions(): void {
    const minSafeGap = 0.03; // 最小安全車距（弧度）
    const softGap = 0.06;    // 開始減速的距離

    for (const vehicle of this.vehicles) {
      const leader = this.getLeader(vehicle);
      const gap = this.getGap(vehicle, leader);

      if (gap < softGap && vehicle.velocity > leader.velocity) {
        // 接近中：漸進減速，越近減越多
        const urgency = 1 - (gap - minSafeGap) / (softGap - minSafeGap);
        const targetVelocity = leader.velocity + (vehicle.velocity - leader.velocity) * (1 - urgency * 0.3);
        vehicle.velocity = Math.max(leader.velocity, targetVelocity);
      }

      if (gap < minSafeGap) {
        // 真的碰撞：速度同步前車，位置推回
        vehicle.velocity = leader.velocity;
        vehicle.position = leader.position - minSafeGap;
        if (vehicle.position < 0) {
          vehicle.position += 2 * Math.PI;
        }
      }
    }
  }

  private updateStats(): void {
    if (this.vehicles.length === 0) return;

    const velocities = this.vehicles.map(v => v.velocity);
    const avg = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const squareDiffs = velocities.map(v => Math.pow(v - avg, 2));
    const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / velocities.length);

    // 每 0.1 秒記錄一次歷史
    const shouldRecord = this.stats.velocityHistory.length === 0 ||
      this.simulationTime - (this.stats.velocityHistory.length * 0.1) >= 0.1;

    if (shouldRecord) {
      this.stats.velocityHistory.push(avg);
      if (this.stats.velocityHistory.length > this.HISTORY_LENGTH) {
        this.stats.velocityHistory.shift();
      }
    }

    this.stats = {
      time: this.simulationTime,
      averageVelocity: avg,
      velocityStdDev: stdDev,
      velocityHistory: this.stats.velocityHistory
    };

    this.onStatsUpdate?.(this.stats);
  }

  // ========== 私有方法：渲染 ==========

  private render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 清空畫布
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    this.drawTrack();

    // 繪製車輛
    for (const vehicle of this.vehicles) {
      this.drawVehicle(vehicle);
    }

    // 繪製歷史圖表
    this.drawHistoryChart();
  }

  private drawTrack(): void {
    const ctx = this.ctx;
    const radius = this.config?.trackRadius || 180;

    // 外環
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, radius + 15, 0, 2 * Math.PI);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 30;
    ctx.stroke();

    // 道路標線
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 方向箭頭
    const arrowCount = 8;
    for (let i = 0; i < arrowCount; i++) {
      const angle = (i / arrowCount) * 2 * Math.PI;
      const x = this.centerX + Math.cos(angle) * radius;
      const y = this.centerY + Math.sin(angle) * radius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);

      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 2);
      ctx.lineTo(-4, 2);
      ctx.closePath();
      ctx.fillStyle = '#4a5568';
      ctx.fill();

      ctx.restore();
    }
  }

  private drawVehicle(vehicle: Vehicle): void {
    const ctx = this.ctx;
    const radius = this.config?.trackRadius || 180;
    const angle = vehicle.position;

    const x = this.centerX + Math.cos(angle) * radius;
    const y = this.centerY + Math.sin(angle) * radius;

    // 速度顏色
    const velocityColor = this.getVelocityColor(vehicle.velocity, vehicle.desiredVelocity);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);

    // 車身
    ctx.fillStyle = velocityColor;
    ctx.fillRect(-5, -8, 10, 16);

    // 類型邊框
    ctx.strokeStyle = vehicle.typeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-5, -8, 10, 16);

    // 擾動中效果：閃爍 + 特殊標記
    if (vehicle.disruptionAction) {
      const flash = Math.sin(this.simulationTime * 15) > 0;
      if (flash) {
        ctx.fillStyle = vehicle.disruptionAction === 'brake'
          ? 'rgba(255, 0, 0, 0.6)'
          : 'rgba(255, 255, 0, 0.6)';
        ctx.fillRect(-5, -8, 10, 16);
      }
      // 擾動標記
      ctx.fillStyle = vehicle.disruptionAction === 'brake' ? '#ff0000' : '#ffff00';
      ctx.beginPath();
      ctx.arc(0, -12, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
  }

  private getVelocityColor(velocity: number, maxVelocity: number): string {
    const ratio = Math.min(1, velocity / maxVelocity);

    if (ratio < 0.3) {
      return '#ff4444';
    } else if (ratio < 0.6) {
      return '#ffaa00';
    } else if (ratio < 0.85) {
      return '#88cc00';
    } else {
      return '#44dd44';
    }
  }

  private drawHistoryChart(): void {
    if (!this.historyCanvas || !this.historyCtx) return;

    const canvas = this.historyCanvas;
    const ctx = this.historyCtx;
    const data = this.stats.velocityHistory;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    if (data.length < 2) return;

    const max = Math.max(...data, this.config?.baseDesiredVelocity || 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    // 背景格線
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 折線
    ctx.beginPath();
    ctx.strokeStyle = '#78c2ad';
    ctx.lineWidth = 2;

    data.forEach((val, i) => {
      const x = (i / (this.HISTORY_LENGTH - 1)) * w;
      const y = h - ((val - min) / range) * (h - 20) - 10;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  // ========== 私有方法：遊戲迴圈 ==========

  private gameLoop(timestamp: number): void {
    if (this.state !== 'running') return;

    const rawDt = (timestamp - this.lastTimestamp) / 1000;
    const dt = Math.min(rawDt, 0.1) * this.config.timeScale; // 限制最大 dt，避免跳幀
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
  }
}
