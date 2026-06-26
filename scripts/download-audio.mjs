/**
 * 预下载所有词汇的 TTS 音频，保存到 audio-exports/
 * 前提：本地 FastAPI 服务器在 5200 端口运行
 * 运行：node scripts/download-audio.mjs
 * 下载完成后，把 audio-exports/ 目录上传到腾讯 COS：
 *   coscli sync ./audio-exports/ cos://<bucket>/ielts-listening-audio/
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')
const outDir = resolve(root, 'audio-exports')
mkdirSync(outDir, { recursive: true })

const VOICE = 'zh_female_yingyujiaoxue_uranus_bigtts'
const API = 'http://127.0.0.1:5200/api/tts/audio'

function readWords(file) {
  const raw = JSON.parse(readFileSync(resolve(root, 'src/data', file), 'utf8'))
  return (raw.words || []).map(x => x.w).filter(Boolean)
}

const allWords = [...new Set([
  ...readWords('vocab_main.json'),
  ...readWords('vocab_phrases.json'),
])]

console.log(`共 ${allWords.length} 个词，开始下载…\n`)

let ok = 0, skip = 0, fail = 0
for (const word of allWords) {
  // 文件名：直接用词文本，空格保留（COS 支持），便于核查
  const filename = `${word}.mp3`
  const dest = resolve(outDir, filename)
  if (existsSync(dest)) { skip++; process.stdout.write('.'); continue }

  try {
    const url = `${API}?${new URLSearchParams({ text: word, voice: VOICE })}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(dest, buf)
    ok++
    process.stdout.write('✓')
  } catch (e) {
    fail++
    console.error(`\n✗ ${word}: ${e.message}`)
  }
  // 限速：避免把 TTS 接口打挂
  await new Promise(r => setTimeout(r, 300))
}

console.log(`\n\n完成：新下载 ${ok} ，已跳过 ${skip}，失败 ${fail}`)
console.log(`\n下一步：把 audio-exports/ 上传到 COS`)
console.log(`  coscli sync ./audio-exports/ cos://<你的bucket>/ielts-listening-audio/ --recursive`)
