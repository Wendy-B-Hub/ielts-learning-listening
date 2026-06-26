<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { vocabData, audioUrl, type Word } from '../data/index'

const router = useRouter()
const cat = ref<'main' | 'phrases'>('main')
const search = ref('')

const audioCache = new Map<string, string>()
let currentAudio: HTMLAudioElement | null = null
const playingWord = ref('')

const currentWords = computed(() => vocabData[cat.value])
const filtered = computed<Word[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return currentWords.value
  return currentWords.value.filter(w => w.w.toLowerCase().includes(q) || w.m?.includes(q))
})

async function playWord(w: string) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  if (playingWord.value === w) { playingWord.value = ''; return }
  playingWord.value = w
  try {
    let url = audioCache.get(w)
    if (!url) {
      const src = audioUrl(w)
      const r = await fetch(src)
      if (!r.ok) throw new Error('')
      url = URL.createObjectURL(await r.blob())
      audioCache.set(w, url)
    }
    const a = new Audio(url)
    currentAudio = a
    a.onended = () => { if (playingWord.value === w) playingWord.value = '' }
    a.onerror = () => { playingWord.value = '' }
    await a.play()
  } catch {
    playingWord.value = ''
  }
}

function startDictation() {
  router.push({ path: '/dictation', query: { cat: cat.value } })
}
</script>

<template>
  <div class="home">

    <header class="header">
      <div class="header-inner">
        <div class="header-title">
          <span class="header-icon">🔤</span>
          <div>
            <h1>雅思听力词汇</h1>
            <p class="header-sub">先听后认 · 听音辨词训练</p>
          </div>
        </div>
      </div>
    </header>

    <div class="cat-tabs">
      <button class="cat-tab" :class="{ on: cat === 'main' }" @click="cat = 'main'">
        📒 听力词汇
        <span class="badge" :class="{ on: cat === 'main' }">{{ vocabData.main.length }}</span>
      </button>
      <button class="cat-tab" :class="{ on: cat === 'phrases' }" @click="cat = 'phrases'">
        📌 常见词组
        <span class="badge" :class="{ on: cat === 'phrases' }">{{ vocabData.phrases.length }}</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          v-model="search"
          class="search-input"
          placeholder="搜索单词或释义…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
        />
        <button v-if="search" class="search-clear" @click="search = ''">✕</button>
      </div>
    </div>

    <div class="list-wrap">
      <p v-if="!filtered.length" class="tip">没有匹配的词</p>
      <ul v-else class="word-list">
        <li v-for="item in filtered" :key="item.w" class="word-item">
          <button
            class="play-btn"
            :class="{ playing: playingWord === item.w }"
            @click="playWord(item.w)"
            :aria-label="`播放 ${item.w}`"
          >
            <span>{{ playingWord === item.w ? '🔊' : '▶' }}</span>
          </button>
          <div class="word-info">
            <span class="word-en">{{ item.w }}</span>
            <span v-if="item.m" class="word-zh">{{ item.m }}</span>
          </div>
        </li>
      </ul>
    </div>

    <div class="bottom-bar">
      <div class="bottom-inner">
        <div class="bottom-stat">
          <span class="stat-num">{{ currentWords.length }}</span>
          <span class="stat-label">个词 · 随机打乱</span>
        </div>
        <button class="btn-start" @click="startDictation">
          🎧 开始练习
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.home { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }

.header { background: var(--blue); padding-top: var(--sat); flex-shrink: 0; }
.header-inner { padding: 14px 20px; }
.header-title { display: flex; align-items: center; gap: 12px; }
.header-icon { font-size: 32px; }
.header h1 { font-size: 1.2rem; font-weight: 700; color: #fff; }
.header-sub { font-size: 0.78rem; color: rgba(255,255,255,.8); margin-top: 2px; }

.cat-tabs { display: flex; background: #fff; border-bottom: 2px solid var(--blue-light); flex-shrink: 0; }
.cat-tab {
  flex: 1; padding: 14px 8px; font-size: 0.9rem; font-weight: 600; color: var(--muted);
  background: transparent; border-bottom: 3px solid transparent; margin-bottom: -2px;
  display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 52px;
}
.cat-tab.on { color: var(--blue); border-bottom-color: var(--blue); }
.badge { font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 10px; background: var(--blue-light); color: var(--blue); }
.badge.on { background: var(--blue); color: #fff; }

.search-bar { background: #fff; padding: 10px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.search-wrap { display: flex; align-items: center; background: var(--bg); border-radius: 12px; border: 1.5px solid var(--border); padding: 0 12px; gap: 8px; }
.search-icon { font-size: 15px; color: var(--muted); flex-shrink: 0; }
.search-input { flex: 1; padding: 11px 0; border: none; background: transparent; color: var(--text); font-size: 16px; }
.search-input:focus { outline: none; }
.search-input::placeholder { color: var(--muted); }
.search-clear { background: none; color: var(--muted); font-size: 15px; padding: 4px; flex-shrink: 0; }

.list-wrap { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 16px; }
.tip { text-align: center; color: var(--muted); padding: 48px 0; font-size: 0.95rem; }
.word-list { list-style: none; }
.word-item { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--border); min-height: 56px; }
.play-btn { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; background: var(--blue-light); color: var(--blue); font-size: 15px; display: flex; align-items: center; justify-content: center; }
.play-btn.playing { background: var(--blue); color: #fff; }
.word-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.word-en { font-size: 1.05rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.word-zh { font-size: 0.83rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.bottom-bar { background: #fff; border-top: 1px solid var(--border); padding-bottom: var(--sab); flex-shrink: 0; }
.bottom-inner { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; gap: 16px; }
.bottom-stat { display: flex; align-items: baseline; gap: 5px; }
.stat-num { font-size: 1.5rem; font-weight: 800; color: var(--blue); }
.stat-label { font-size: 0.82rem; color: var(--muted); }
.btn-start { background: var(--blue); color: #fff; border-radius: 14px; padding: 14px 26px; font-size: 1rem; font-weight: 700; box-shadow: 0 4px 16px rgba(29,78,216,.35); white-space: nowrap; min-height: 52px; }
</style>
