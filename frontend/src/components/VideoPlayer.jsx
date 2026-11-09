import { useI18n } from '../i18n/index.jsx'
import { toEmbedUrl } from '../utils/video.js'
import Icon from './Icon.jsx'

/* مشغّل فيديو متجاوب 16:9. يوتيوب/فيميو بيتضمّنوا آمنين، وأي رابط تاني بيتعرض كزر "فتح الفيديو". */
export default function VideoPlayer({ url, title }) {
  const { t } = useI18n()
  const embed = toEmbedUrl(url)

  if (!embed) {
    return (
      <a className="card video-fallback" href={url} target="_blank" rel="noopener noreferrer">
        <Icon name="play" size={28} />
        <div>
          <strong>{t('learn.openVideo')}</strong>
          <small>{t('learn.externalVideo')}</small>
        </div>
      </a>
    )
  }

  return (
    <div className="video-frame">
      <iframe
        src={embed}
        title={title}
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  )
}
