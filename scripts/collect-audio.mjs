/**
 * 从门户的 TTS 缓存里，把每个词的音频按 tab 分区收集到 audio-exports/
 * 不需要联网、不调用 TTS 接口——直接复用已合成好的 mp3。
 *
 * 产物结构（与 COS 桶根目录一一对应；bucket 本身已叫 ielts-listening-audio，不再加前缀）：
 *   audio-exports/
 *     main/         <词>.mp3      ← 听力词汇 tab
 *     phrases/      <词>.mp3      ← 常见词组 tab
 *     manifest.json 词↔音频↔公网链接 绑定清单
 *
 * 文件名用「原词文本」，与前端 audioUrl(word, cat) 的 encodeURIComponent(word) 对应。
 * 运行：node scripts/collect-audio.mjs
 * 上传：coscli sync ./audio-exports/ cos://<bucket>/ --recursive
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync, rmSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')
const outDir = resolve(root, 'audio-exports')

// 与门户服务器 server.py 中的缓存命名规则完全一致
const VOICE = 'zh_female_yingyujiaoxue_uranus_bigtts'
const RATE = 0
const CACHE_DIR = resolve(root, '../IELTS学习门户/tts_cache', VOICE)

// COS 公网访问域名（与 .env.production 一致，不带末尾斜杠）。用于生成 manifest 里的完整链接。
const COS_BASE = (process.env.VITE_COS_BASE_URL
  || 'https://ielts-listening-audio-1386652216.cos.ap-guangzhou.myqcloud.com').replace(/\/$/, '')

// tab → 源 JSON
const TABS = [
  { cat: 'main', file: 'vocab_main.json' },
  { cat: 'phrases', file: 'vocab_phrases.json' },
]

function slug(text) {
  const s = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return (s || 'x').slice(0, 40)
}
function cacheName(text) {
  const h = createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 8)
  return `${slug(text)}__r${RATE}__${h}.mp3`
}
function readWords(file) {
  const raw = JSON.parse(readFileSync(resolve(root, 'src/data', file), 'utf8'))
  return (raw.words || []).map(x => x.w).filter(Boolean)
}

// 每次全量重建，避免删词后留下孤儿文件
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })

let total = 0, copied = 0
const missing = []
// 词↔音频↔公网链接 绑定清单：{ base, main: {词: url}, phrases: {词: url} }
const manifest = { base: COS_BASE, voice: VOICE, main: {}, phrases: {} }

for (const { cat, file } of TABS) {
  const tabDir = resolve(outDir, cat)
  mkdirSync(tabDir, { recursive: true })
  const words = [...new Set(readWords(file))]
  for (const word of words) {
    total++
    const src = resolve(CACHE_DIR, cacheName(word))
    if (!existsSync(src)) { missing.push({ cat, word }); continue }
    copyFileSync(src, resolve(tabDir, `${word}.mp3`))
    // 对象键：<tab>/<词>.mp3；链接里词文本按 URL 规则编码（与前端 audioUrl 一致）
    manifest[cat][word] = `${COS_BASE}/${cat}/${encodeURIComponent(word)}.mp3`
    copied++
  }
  console.log(`✓  ${cat.padEnd(8)} ${words.length} 个词`)
}

writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

console.log(`\n完成：复制 ${copied}/${total}，缺失 ${missing.length}`)
console.log(`绑定清单：audio-exports/manifest.json（${copied} 条 词→链接）`)
if (missing.length) {
  console.log('\n以下词在缓存里没有 mp3（需要先在门户里听一遍生成）：')
  for (const { cat, word } of missing) console.log(`   [${cat}] ${word}`)
}
console.log(`\n下一步：把音频上传到 COS 桶根目录（bucket 已叫 ielts-listening-audio，不要再套一层同名目录）`)
console.log(`  coscli sync ./audio-exports/ cos://<你的bucket>/ --recursive`)
