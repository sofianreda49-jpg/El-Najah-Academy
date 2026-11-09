import { Link } from 'react-router-dom'

import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import ActivityChart from '../components/ActivityChart.jsx'
import Icon from '../components/Icon.jsx'
import Skeleton from '../components/Skeleton.jsx'
import StatCard from '../components/StatCard.jsx'
import { ACTION_LABELS, ENTITY_LABELS } from '../constants.js'
import { useApi } from '../hooks/useApi.js'
import { useI18n } from '../i18n/index.jsx'
import { greetingKey } from '../utils/greeting.js'

export default function Dashboard() {
  const { user } = useAuth()
  const { t, fmtDate } = useI18n()
  const overview = useApi(() => api('/admin/overview'), [])
  const health = useApi(() => api('/health', { auth: false }), [])

  const o = overview.data
  const loading = overview.loading && !o
  const firstName = user.full_name.split(' ')[0]
  const dateTime = { dateStyle: 'medium', timeStyle: 'short' }

  // ترجمة اسم العملية/الكيان، ولو مفيش ترجمة نرجع للنص العربي الأصلي
  const labelOf = (prefix, key, fallback) => {
    const text = t(`${prefix}.${key}`)
    return text === `${prefix}.${key}` ? fallback || key : text
  }

  const serverState = health.loading ? 'checking' : health.error ? 'down' : 'ok'

  if (overview.error) {
    return (
      <div className="card empty-block">
        <div className="alert alert-danger" role="alert">{overview.error}</div>
        <button className="btn btn-ghost" type="button" onClick={overview.reload}>{t('common.retry')}</button>
      </div>
    )
  }

  return (
    <>
      <section className="dash-hero">
        <h1>{t('dash.welcome', { name: firstName })}</h1>
        <div className="hero-pills">
          <span className="hero-pill">{t(`role.${user.role}`)}</span>
          <span className={`status-pill ${serverState === 'ok' ? 'good' : serverState === 'down' ? 'bad' : ''}`}>
            <span className="dot" />
            {serverState === 'ok' ? t('dash.server.ok') : serverState === 'down' ? t('dash.server.down') : t('dash.server.checking')}
          </span>
        </div>
      </section>

      {o && o.pending_total > 0 && (
        <div className="banner" role="status">
          <div>
            <strong>{t('dash.pending.title')}</strong>
            <span>{t('dash.pending.count', { n: o.pending_total })}</span>
          </div>
          <Link className="btn btn-primary btn-sm" to="/requests">{t('dash.pending.review')}</Link>
        </div>
      )}

      <div className="stat-tiles">
        <StatCard icon="book" tone="navy" loading={loading} label={t('dash.stat.students')} value={o?.users.students} />
        <StatCard icon="academy" tone="gold" loading={loading} label={t('dash.stat.teachers')} value={o?.users.teachers} />
        <StatCard icon="users" tone="green" loading={loading} label={t('dash.stat.parents')} value={o?.users.parents} />
        <StatCard icon="layers" tone="blue" loading={loading} label={t('dash.stat.courses')} value={o?.content.courses_total}
                  hint={o ? t('dash.stat.coursesHint', { n: o.content.courses_published, total: o.content.courses_total }) : null} />
      </div>
      <div className="stat-tiles">
        <StatCard icon="play" tone="navy" loading={loading} label={t('dash.stat.lessons')} value={o?.content.lessons_published} />
        <StatCard icon="audit" tone="gold" loading={loading} label={t('dash.stat.assessments')} value={o?.content.assessments_published} />
        <StatCard icon="user" tone="green" loading={loading} label={t('dash.stat.newUsers')} value={o?.week.new_users} />
        <StatCard icon="chart" tone="blue" loading={loading} label={t('dash.stat.attempts')} value={o?.week.attempts} />
      </div>

      <div className="dash-columns">
        <section className="card card-pad">
          <h3>{t('dash.activity.title')}</h3>
          {loading ? (
            <Skeleton h={190} />
          ) : (
            <ActivityChart data={o.activity} labelA={t('dash.activity.lessons')} labelB={t('dash.activity.attempts')} />
          )}
        </section>

        <section className="card card-pad">
          <h3>{t('dash.quick.title')}</h3>
          <div className="quick-actions">
            <Link className="btn btn-secondary btn-sm" to="/users"><Icon name="users" size={16} /> {t('dash.quick.users')}</Link>
            <Link className="btn btn-secondary btn-sm" to="/academy"><Icon name="academy" size={16} /> {t('dash.quick.academy')}</Link>
            <Link className="btn btn-secondary btn-sm" to="/requests"><Icon name="audit" size={16} /> {t('dash.quick.requests')}</Link>
          </div>

          <h3 style={{ marginTop: 22 }}>{t('dash.pending.title')}</h3>
          {loading ? (
            <Skeleton h={60} />
          ) : o.pending_preview.length === 0 ? (
            <p className="muted">{t('dash.pending.empty')}</p>
          ) : (
            o.pending_preview.map((p) => (
              <Link className="list-row" key={p.id} to="/requests">
                <div>
                  <div className="list-title">{p.full_name}</div>
                  <div className="list-meta">{fmtDate(p.created_at)}</div>
                </div>
                <span className="badge badge-muted">{t(`role.${p.role}`)}</span>
              </Link>
            ))
          )}
        </section>
      </div>

      {user.role === 'super_admin' && (
        <>
          <div className="section-row">
            <h2>{t('dash.events.title')}</h2>
            <Link className="section-link" to="/audit">{t('dash.events.all')}</Link>
          </div>
          <section className="card list-card">
            {loading ? (
              <div className="card-pad"><Skeleton h={80} /></div>
            ) : o.recent_events.length === 0 ? (
              <div className="empty-block"><p>{t('dash.events.empty')}</p></div>
            ) : (
              o.recent_events.map((e) => (
                <div className="list-row" key={e.id}>
                  <div>
                    <div className="list-title">
                      {labelOf('action', e.action, ACTION_LABELS[e.action])}
                      {e.target_type ? ` · ${labelOf('entity', e.target_type, ENTITY_LABELS[e.target_type])}` : ''}
                    </div>
                    <div className="list-meta">
                      {e.actor_name ? t('dash.events.by', { name: e.actor_name }) : '—'}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </div>
                  </div>
                  <span className="list-meta">{fmtDate(e.created_at, dateTime)}</span>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </>
  )
}
