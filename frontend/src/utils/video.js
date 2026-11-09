// بيحوّل رابط يوتيوب/فيميو لرابط تضمين آمن. أي رابط تاني بيرجّع null (بنعرضه كزر "فتح الفيديو").
const YT_ID = /^[\w-]{6,20}$/

export function toEmbedUrl(raw) {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v')
      if (id && YT_ID.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
      const m = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,20})/)
      if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1)
      if (YT_ID.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
    }
    if (host === 'vimeo.com') {
      const m = u.pathname.match(/^\/(\d+)/)
      if (m) return `https://player.vimeo.com/video/${m[1]}`
    }
  } catch {
    /* رابط غير صالح */
  }
  return null
}
