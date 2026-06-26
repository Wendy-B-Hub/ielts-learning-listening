/**
 * 把父项目的 vocab JSON 复制到 src/data/
 * 运行：node scripts/export-vocab.mjs
 * 每次在本地修改词汇后、构建前运行一次。
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')
const parent = resolve(__dir, '../../IELTS学习门户')

const cats = [
  { src: 'vocab.json',         dst: 'vocab_main.json' },
  { src: 'vocab_phrases.json', dst: 'vocab_phrases.json' },
]

for (const { src, dst } of cats) {
  const raw = JSON.parse(readFileSync(resolve(parent, src), 'utf8'))
  const words = (raw.words || [])
    .filter(x => x?.w)
    .map(({ w, m }) => ({ w, ...(m ? { m } : {}) })) // 只保留 w 和 m，去掉 added_at 等

  const out = resolve(root, 'src/data', dst)
  writeFileSync(out, JSON.stringify({ words }, null, 2), 'utf8')
  console.log(`✓  ${dst}  →  ${words.length} 条`)
}
