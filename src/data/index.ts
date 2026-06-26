import mainRaw from './vocab_main.json'
import phrasesRaw from './vocab_phrases.json'

export interface Word { w: string; m?: string }

function clean(raw: { words?: unknown[] }): Word[] {
  return ((raw.words ?? []) as Word[]).filter(x => x?.w)
}

export const vocabData: Record<'main' | 'phrases', Word[]> = {
  main: clean(mainRaw as { words?: unknown[] }),
  phrases: clean(phrasesRaw as { words?: unknown[] }),
}

const VOICE = 'zh_female_yingyujiaoxue_uranus_bigtts'
const COS_BASE = (import.meta.env.VITE_COS_BASE_URL as string | undefined)?.replace(/\/$/, '')

/** 构造音频 URL：生产环境用 COS（bucket 即 ielts-listening-audio，对象键按 tab 分区），开发环境走本地 API 代理 */
export function audioUrl(word: string, cat: 'main' | 'phrases' = 'main'): string {
  if (COS_BASE) {
    return `${COS_BASE}/${cat}/${encodeURIComponent(word)}.mp3`
  }
  return `/api/tts/audio?${new URLSearchParams({ text: word, voice: VOICE })}`
}
