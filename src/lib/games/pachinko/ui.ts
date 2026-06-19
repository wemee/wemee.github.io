// 通用前端：依目前選定的機台模組，自動畫盤面、數據、流程導覽。
// UI 不認識任何機台細節，全部透過機台提供的 ports/stats/guide/flow/describe 來呈現。
import { createCore, type Core, type FlowItem, type Machine, type PachinkoEvent, type PachinkoState, type StatRow } from './core';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initPachinko(machineList: Machine[]): void {
  const $ = (id: string) => document.getElementById(id)!;

  let engine: Core | null = null;
  let autoTimer: ReturnType<typeof setInterval> | null = null;

  // ---- 機台選單 ----
  const select = $('machineSelect') as HTMLSelectElement;
  machineList.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = m.spec.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => loadMachine(machineList[Number(select.value)]));

  // ---- 載入一台機器 ----
  function loadMachine(machine: Machine) {
    stopAuto();
    engine = createCore(machine);
    buildFlow(machine);
    $('reels').style.display = machine.hasReels ? 'flex' : 'none';
    $('flow-note').textContent = machine.note || '';
    $('log').innerHTML = '';
    engine.on(onEvent);
    render(engine.snapshot());
  }

  function buildFlow(machine: Machine) {
    const ol = $('flow-list');
    ol.innerHTML = '';
    machine.flow.forEach((item: FlowItem) => {
      const li = document.createElement('li');
      if (item.arrow) {
        li.className = 'arrow';
        li.textContent = item.arrow;
      } else {
        li.setAttribute('data-step', item.id!);
        li.innerHTML =
          '<b>' + item.no + ' ' + item.title + '</b><span>' + item.dir + '</span><em>' + item.desc + '</em>';
      }
      ol.appendChild(li);
    });
  }

  // ---- 繪製 ----
  const dirLabel: Record<string, string> = { LEFT: '← 左打', RIGHT: '→ 右打' };

  function render(state: PachinkoState) {
    const m = engine!.machine;
    const g = m.guide(state);

    $('phase').textContent = g.title;
    $('phase').className = 'phase phase-' + state.phase;
    $('direction').textContent = dirLabel[state.shootDirection];

    drawBoard(m.ports(state));

    const reels = (state as any).reels as number[] | undefined;
    if (m.hasReels && reels) {
      reels.forEach((n, i) => ($('reel' + i).textContent = String(n)));
    }

    renderStats(state, m);

    // 導覽
    $('g-title').textContent = g.title;
    $('g-goal').textContent = g.goal;
    $('g-prob').textContent = g.prob;
    $('g-hint').textContent = g.hint;
    document.querySelectorAll('.flow li[data-step]').forEach((li) => {
      li.classList.toggle('active', li.getAttribute('data-step') === g.step);
    });
  }

  function renderStats(state: PachinkoState, m: Machine) {
    const net = state.balls - state.invested;
    const rows: StatRow[] = [
      { label: '持珠', value: state.balls },
      { label: '投資', value: state.invested },
      { label: '差玉', value: (net >= 0 ? '+' : '') + net, color: net >= 0 ? '#5cd6a0' : '#e8483c' },
      { label: '累計發射', value: state.totalLaunched },
    ].concat(m.stats(state));

    const box = $('stats');
    box.innerHTML = '';
    rows.forEach((r) => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      span.textContent = r.label;
      const b = document.createElement('b');
      b.textContent = String(r.value);
      if (r.color) b.style.color = r.color;
      div.appendChild(span);
      div.appendChild(b);
      box.appendChild(div);
    });
  }

  function drawBoard(ports: { label: string; on: boolean }[]) {
    const svg = $('board-svg');
    svg.innerHTML = '';
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', '2');
    bg.setAttribute('y', '2');
    bg.setAttribute('width', '396');
    bg.setAttribute('height', '116');
    bg.setAttribute('rx', '10');
    bg.setAttribute('fill', '#11131a');
    bg.setAttribute('stroke', '#3a3f4a');
    bg.setAttribute('stroke-width', '2');
    svg.appendChild(bg);

    const n = ports.length;
    const slot = 396 / n;
    ports.forEach((p, i) => {
      const cx = 2 + slot * (i + 0.5);
      const w = Math.min(slot - 16, 90);
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(cx - w / 2));
      rect.setAttribute('y', '38');
      rect.setAttribute('width', String(w));
      rect.setAttribute('height', '30');
      rect.setAttribute('rx', '5');
      rect.setAttribute('fill', p.on ? '#e8483c' : '#2a2e36');
      rect.setAttribute('stroke', p.on ? '#ffcc4d' : '#3a3f4a');
      rect.setAttribute('stroke-width', p.on ? '2' : '1');
      svg.appendChild(rect);

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', String(cx));
      text.setAttribute('y', '92');
      text.setAttribute('fill', p.on ? '#ffcc4d' : '#9aa0ab');
      text.setAttribute('font-size', '13');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = p.label;
      svg.appendChild(text);
    });
  }

  // ---- 事件 / log ----
  function log(msg: string) {
    const box = $('log');
    const line = document.createElement('div');
    line.textContent = msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
    while (box.childNodes.length > 200) box.removeChild(box.firstChild!);
  }

  function onEvent(evt: PachinkoEvent) {
    let msg: string | null = null;
    if (evt.type === 'insert') {
      msg = '投入 1000 円（+' + engine!.spec.insertAmount + '，投資 ' + evt.state.invested + '）';
    } else if (evt.type === 'empty') {
      msg = '⚠ 持珠用盡，需投入 1000 円';
      stopAuto();
    } else if (evt.type !== 'reset') {
      msg = engine!.machine.describe ? engine!.machine.describe(evt) : null;
    }
    if (msg) log(msg);
    render(evt.state);
  }

  // ---- 控制 ----
  $('shoot').addEventListener('click', () => engine!.shoot());
  $('insert').addEventListener('click', () => engine!.insert());
  $('reset').addEventListener('click', () => engine!.reset());

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      $('auto').textContent = '自動發射';
    }
  }
  $('auto').addEventListener('click', () => {
    if (autoTimer) stopAuto();
    else {
      autoTimer = setInterval(() => engine!.shoot(), 30);
      $('auto').textContent = '停止';
    }
  });

  // 初始載入第一台
  loadMachine(machineList[0]);
}
