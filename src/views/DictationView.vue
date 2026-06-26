<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { vocabData, audioUrl, type Word } from '../data/index'

const route = useRoute()
const router = useRouter()

const RATES = [0.75, 1, 1.25, 1.5, 1.8, 2]

const cat: 'main' | 'phrases' = route.query.cat === 'phrases' ? 'phrases' : 'main'

const words = ref<Word[]>([])
const loading = ref(false)
const err = ref('')

const queue = ref<number[]>([])
const pos = ref(0)
const mastered = ref(0)
const total = ref(0)

type Phase = 'idle' | 'playing' | 'revealed'
const phase = ref<Phase>('idle')
const playedOnce = ref(false)

const rate = ref(Number(localStorage.getItem('lvpwa:rate')) || 1)
const autoPlay = ref(localStorage.getItem('lvpwa:autoplay') !== 'false')
const showSettings = ref(false)

const audioCache = new Map<string, string>()
let currentAudio: HTMLAudioElement | null = null
const isPlaying = ref(false)
const loadingAudio = ref(false)

// 左滑/右滑手势
let touchStartX = 0
let touchStartY = 0

const curWord = computed((): Word | null =>
  pos.value < queue.value.length ? (words.value[queue.value[pos.value]] ?? null) : null
)
const isDone = computed(() => !loading.value && !err.value && pos.value >= queue.value.length && words.value.length > 0)
const progress = computed(() => total.value ? pos.value / total.value : 0)
const progressPct = computed(() => Math.min(100, Math.round(progress.value * 100)))

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function startRound(ws: Word[]) {
  words.value = ws
  queue.value = shuffle(ws.map((_, i) => i))
  total.value = queue.value.length
  pos.value = 0
  mastered.value = 0
  resetCard()
  if (autoPlay.value) setTimeout(() => playCard(), 400)
}

function resetCard() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  isPlaying.value = false
  loadingAudio.value = false
  phase.value = 'idle'
  playedOnce.value = false
}

async function playCard() {
  const w = curWord.value
  if (!w) return
  // 正在播放时点击 → 停止
  if (isPlaying.value && currentAudio) {
    currentAudio.pause(); currentAudio = null
    isPlaying.value = false; phase.value = 'idle'
    return
  }
  isPlaying.value = true
  loadingAudio.value = true
  phase.value = 'playing'
  try {
    let url = audioCache.get(w.w)
    if (!url) {
      const resp = await fetch(audioUrl(w.w, cat))
      if (!resp.ok) throw new Error('音频加载失败 ' + resp.status)
      url = URL.createObjectURL(await resp.blob())
      audioCache.set(w.w, url)
    }
    loadingAudio.value = false
    const a = new Audio(url)
    a.playbackRate = rate.value
    a.preservesPitch = true
    currentAudio = a
    playedOnce.value = true
    a.onended = () => { isPlaying.value = false; phase.value = 'idle' }
    a.onerror = () => { isPlaying.value = false; loadingAudio.value = false; phase.value = 'idle' }
    await a.play()
  } catch {
    isPlaying.value = false
    loadingAudio.value = false
    phase.value = 'idle'
  }
}

function reveal() {
  if (!playedOnce.value) return
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  isPlaying.value = false
  phase.value = 'revealed'
}

function markMastered() {
  mastered.value++
  advance()
}

function markRetry() {
  queue.value.push(queue.value[pos.value])
  total.value++
  advance()
}

function advance() {
  pos.value++
  resetCard()
  if (!isDone.value && autoPlay.value) setTimeout(() => playCard(), 400)
}

function restart() { startRound(words.value) }

// 键盘
function onKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'SELECT') return
  if (isDone.value) return
  if (e.code === 'Space') {
    e.preventDefault(); playCard()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (phase.value === 'revealed') markMastered()
    else if (playedOnce.value) reveal()
  } else if (e.key === 'ArrowRight' && phase.value === 'revealed') {
    e.preventDefault(); markMastered()
  } else if (e.key === 'ArrowLeft' && phase.value === 'revealed') {
    e.preventDefault(); markRetry()
  }
}

// 滑动手势（左滑=再练，右滑=会了）
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}
function onTouchEnd(e: TouchEvent) {
  if (phase.value !== 'revealed') return
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  // 水平滑动幅度 > 60px 且垂直偏移 < 水平的一半
  if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) {
    dx > 0 ? markMastered() : markRetry()
  }
}

function setRate(r: number) {
  rate.value = r
  localStorage.setItem('lvpwa:rate', String(r))
}
function toggleAutoPlay() {
  autoPlay.value = !autoPlay.value
  localStorage.setItem('lvpwa:autoplay', String(autoPlay.value))
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  const ws = vocabData[cat] ?? vocabData.main
  if (!ws.length) { err.value = '词汇库为空'; return }
  startRound(ws)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
})
</script>

<template>
  <div
    class="dictation"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >

    <!-- 顶部栏（处理 Dynamic Island） -->
    <header class="top-bar">
      <button class="back-btn" @click="router.push('/')">←</button>

      <div class="progress-area">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <span class="progress-label">{{ pos }} / {{ total }}</span>
      </div>

      <button class="settings-btn" @click="showSettings = !showSettings" :class="{ active: showSettings }">
        ⚙
      </button>
    </header>

    <!-- 设置抽屉 -->
    <transition name="slide-down">
      <div v-if="showSettings" class="settings-panel" @click.stop>
        <div class="setting-row">
          <span class="setting-label">播放速度</span>
          <div class="rate-group">
            <button
              v-for="r in RATES" :key="r"
              class="rate-btn"
              :class="{ on: rate === r }"
              @click="setRate(r)"
            >{{ r }}×</button>
          </div>
        </div>
        <div class="setting-row">
          <span class="setting-label">切卡自动播放</span>
          <button class="toggle" :class="{ on: autoPlay }" @click="toggleAutoPlay">
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 加载 / 错误 -->
    <div v-if="loading" class="center">
      <div class="spinner"></div>
      <p class="center-tip">加载中…</p>
    </div>
    <div v-else-if="err" class="center">
      <p class="center-tip red">{{ err }}</p>
      <button class="btn-outline" @click="router.push('/')">← 返回</button>
    </div>

    <!-- 完成页 -->
    <div v-else-if="isDone" class="done">
      <div class="done-emoji">🎉</div>
      <h2 class="done-title">本轮完成！</h2>
      <div class="done-stats">
        <div class="stat-card green">
          <span class="stat-big">{{ mastered }}</span>
          <span class="stat-sub">✓ 已掌握</span>
        </div>
        <div class="stat-card red">
          <span class="stat-big">{{ total - mastered }}</span>
          <span class="stat-sub">↩ 再练次数</span>
        </div>
      </div>
      <button class="btn-primary full" @click="restart">🔄 再练一轮</button>
      <button class="btn-outline full" @click="router.push('/')">← 返回词表</button>
    </div>

    <!-- 练习主体 -->
    <div v-else-if="curWord" class="card-body">

      <!-- 提示文字 -->
      <div class="hint-area">
        <p v-if="phase !== 'revealed'" class="hint">
          {{ playedOnce ? '再听一遍，确认后点「显示」' : '点下方按钮，听单词发音' }}
        </p>
        <p v-else class="hint revealed">← 再练 &nbsp;·&nbsp; 右滑或 → 会了</p>
      </div>

      <!-- 核心播放区 -->
      <div class="play-zone">
        <!-- 速度角标 -->
        <div v-if="rate !== 1" class="rate-badge">{{ rate }}×</div>

        <button
          class="big-play"
          :class="{ playing: isPlaying, loading: loadingAudio }"
          :disabled="loadingAudio"
          @click="playCard"
          :aria-label="isPlaying ? '停止' : '播放'"
        >
          <span v-if="loadingAudio" class="spin">⏳</span>
          <span v-else-if="isPlaying">🔊</span>
          <span v-else>▶</span>
        </button>

        <p class="play-status">
          <span v-if="loadingAudio">合成中…</span>
          <span v-else-if="isPlaying">正在播放（再点停止）</span>
          <span v-else-if="!playedOnce">点击播放</span>
          <span v-else>点击重听</span>
        </p>

        <!-- 未揭示：显示按钮 -->
        <button
          v-if="phase !== 'revealed'"
          class="btn-reveal"
          :class="{ ready: playedOnce }"
          :disabled="!playedOnce"
          @click="reveal"
        >
          {{ playedOnce ? '显示单词 →' : '先听发音…' }}
        </button>
      </div>

      <!-- 揭示区（覆盖 play-zone 下方） -->
      <transition name="fade-up">
        <div v-if="phase === 'revealed'" class="reveal-zone">
          <div class="word-display">
            <p class="word-en">{{ curWord.w }}</p>
            <p v-if="curWord.m" class="word-zh">{{ curWord.m }}</p>
          </div>
        </div>
      </transition>

      <!-- 底部打分区（拇指区，处理 home indicator） -->
      <div class="grade-zone">
        <template v-if="phase === 'revealed'">
          <button class="btn-grade retry" @click="markRetry">
            <span class="grade-icon">✗</span>
            <span class="grade-label">再练</span>
          </button>
          <button class="btn-grade mastered" @click="markMastered">
            <span class="grade-icon">✓</span>
            <span class="grade-label">会了</span>
          </button>
        </template>
        <template v-else>
          <p class="grade-placeholder">播放并显示单词后打分</p>
        </template>
      </div>

    </div>

  </div>
</template>

<style scoped>
.dictation {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
  /* 防止 iOS 下拉刷新 */
  overscroll-behavior: none;
}

/* ── 顶部栏 ── */
.top-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--blue);
  padding: calc(var(--sat) + 10px) 16px 12px;
  flex-shrink: 0;
}
.back-btn {
  background: rgba(255,255,255,.22);
  color: #fff;
  border-radius: 10px;
  width: 40px;
  height: 40px;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.progress-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.progress-track {
  height: 5px;
  background: rgba(255,255,255,.3);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 3px;
  transition: width .35s ease;
}
.progress-label {
  font-size: 0.75rem;
  color: rgba(255,255,255,.85);
  text-align: right;
}
.settings-btn {
  background: rgba(255,255,255,.22);
  color: #fff;
  border-radius: 10px;
  width: 40px;
  height: 40px;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.settings-btn.active { background: rgba(255,255,255,.45); }

/* ── 设置面板 ── */
.settings-panel {
  background: #fff;
  border-bottom: 1px solid var(--border);
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex-shrink: 0;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.setting-label { font-size: 0.92rem; color: var(--text); }
.rate-group { display: flex; gap: 6px; flex-wrap: wrap; }
.rate-btn {
  padding: 6px 11px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  font-size: 0.82rem;
  background: var(--bg);
  color: var(--muted);
  min-height: 36px;
}
.rate-btn.on { border-color: var(--blue); background: var(--blue-light); color: var(--blue); font-weight: 700; }

/* toggle 开关 */
.toggle {
  width: 52px;
  height: 30px;
  border-radius: 15px;
  background: var(--border);
  position: relative;
  transition: background .2s;
}
.toggle.on { background: var(--green); }
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
  transition: left .2s;
}
.toggle.on .toggle-knob { left: 25px; }

/* ── 加载/错误 ── */
.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
}
.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid var(--blue-light);
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.center-tip { color: var(--muted); font-size: 0.95rem; }
.center-tip.red { color: var(--red); }

/* ── 完成页 ── */
.done {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px calc(var(--sab) + 32px);
  gap: 18px;
  text-align: center;
}
.done-emoji { font-size: 64px; }
.done-title { font-size: 1.6rem; font-weight: 800; color: var(--blue); }
.done-stats { display: flex; gap: 14px; width: 100%; max-width: 300px; }
.stat-card {
  flex: 1;
  border-radius: 16px;
  padding: 18px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.stat-card.green { background: var(--green-light); }
.stat-card.red   { background: var(--red-light); }
.stat-big { font-size: 2.2rem; font-weight: 800; }
.stat-card.green .stat-big { color: var(--green); }
.stat-card.red   .stat-big { color: var(--red); }
.stat-sub { font-size: 0.8rem; color: var(--muted); }
.btn-primary {
  background: var(--blue);
  color: #fff;
  border-radius: 14px;
  padding: 16px;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(29,78,216,.3);
}
.btn-outline {
  background: #fff;
  color: var(--blue);
  border: 2px solid var(--blue);
  border-radius: 14px;
  padding: 14px;
  font-size: 1rem;
  font-weight: 600;
}
.full { width: 100%; max-width: 300px; }

/* ── 练习主体 ── */
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 底部 home indicator 安全区由 grade-zone 处理 */
}

.hint-area {
  padding: 14px 24px 0;
  text-align: center;
  flex-shrink: 0;
}
.hint {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.5;
}
.hint.revealed { color: var(--blue); font-weight: 600; }

/* 播放区：居中撑满剩余高度 */
.play-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 24px;
  position: relative;
}
.rate-badge {
  position: absolute;
  top: 8px;
  right: 20px;
  background: var(--amber);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 10px;
}
.big-play {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  font-size: 50px;
  box-shadow: 0 10px 40px rgba(29,78,216,.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .12s, box-shadow .12s;
}
.big-play:active { transform: scale(0.93) !important; }
.big-play.playing {
  animation: pulse 1.4s ease-in-out infinite;
  background: var(--blue-dark);
}
.big-play.loading {
  background: #9ca3af;
  box-shadow: none;
  animation: none;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 10px 40px rgba(29,78,216,.4); }
  50%       { box-shadow: 0 10px 60px rgba(29,78,216,.7); }
}

.play-status {
  font-size: 0.85rem;
  color: var(--muted);
  text-align: center;
  min-height: 1.2em;
}

.btn-reveal {
  padding: 16px 36px;
  border-radius: 16px;
  font-size: 1rem;
  font-weight: 600;
  background: var(--border);
  color: var(--muted);
  border: 2px solid transparent;
  transition: all .2s;
  min-height: 54px;
}
.btn-reveal.ready {
  background: var(--blue-light);
  color: var(--blue);
  border-color: var(--blue);
}

/* 揭示区 */
.reveal-zone {
  padding: 0 24px 8px;
  text-align: center;
  flex-shrink: 0;
}
.word-display { display: flex; flex-direction: column; gap: 6px; }
.word-en {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text);
  letter-spacing: .02em;
  line-height: 1.2;
  word-break: break-word;
}
.word-zh {
  font-size: 1rem;
  color: var(--muted);
}

/* ── 底部打分区（拇指友好） ── */
.grade-zone {
  display: flex;
  gap: 12px;
  padding: 12px 20px calc(var(--sab) + 16px);
  background: #fff;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.btn-grade {
  flex: 1;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 72px;
  /* 视觉反馈 */
  transition: transform .1s;
}
.btn-grade:active { transform: scale(0.95) !important; }
.btn-grade.retry   { background: var(--red-light);   color: var(--red); }
.btn-grade.mastered{ background: var(--green-light);  color: var(--green); }
.grade-icon { font-size: 1.6rem; font-weight: 900; }
.grade-label { font-size: 0.9rem; font-weight: 700; }
.grade-placeholder {
  flex: 1;
  text-align: center;
  font-size: 0.82rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 动画 ── */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { display: inline-block; animation: spin 0.9s linear infinite; }

.slide-down-enter-active, .slide-down-leave-active {
  transition: all .22s ease;
  overflow: hidden;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0; max-height: 0;
}
.slide-down-enter-to, .slide-down-leave-from {
  opacity: 1; max-height: 200px;
}

.fade-up-enter-active, .fade-up-leave-active { transition: all .2s ease; }
.fade-up-enter-from { opacity: 0; transform: translateY(12px); }
.fade-up-leave-to   { opacity: 0; transform: translateY(-6px); }

/* ── 桌面端适配（屏幕宽度 > 500px 时居中显示） ── */
@media (min-width: 500px) {
  .dictation {
    max-width: 440px;
    margin: 0 auto;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }
}
</style>
