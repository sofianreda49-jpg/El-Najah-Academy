import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import FormModal from '../../components/FormModal.jsx'
import Icon from '../../components/Icon.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import Pagination from '../../components/Pagination.jsx'
import QuestionModal, { newQuestion } from '../../components/QuestionModal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useApi } from '../../hooks/useApi.js'
import { formatDateTime } from '../../utils/format.js'
import { newCfg } from '../../utils/ids.js'
import { KIND_LABELS, assessmentBody, assessmentFields } from './assessmentForm.js'
import { tr } from '../../i18n/index.jsx'

const STATUS_LABELS = { get submitted() { return tr("تم التسليم") }, get expired() { return tr("انتهى الوقت") } }

export default function AssessmentBuilder() {
  const { assessmentId } = useParams()
  const toast = useToast()
  const [tab, setTab] = useState('questions')
  const [formCfg, setFormCfg] = useState(null)
  const [questionCfg, setQuestionCfg] = useState(null)
  const [confirmCfg, setConfirmCfg] = useState(null)

  const { data, loading, error, reload } = useApi(() => api(`/assessments/${assessmentId}`), [assessmentId])
  const { data: course } = useApi(
    () => (data ? api(`/academy/courses/${data.course_id}`) : Promise.resolve(null)),
    [data?.course_id],
  )

  const save = async (method, path, body, message) => {
    await api(path, { method, body })
    toast.success(message)
    reload()
  }

  function openSettings() {
    const lessonOptions = course
      ? course.units.flatMap((u) => u.lessons.map((l) => ({ value: l.id, label: `${u.name} — ${l.title}` })))
      : []
    setFormCfg(newCfg({
      title: tr("إعدادات الاختبار"),
      fields: assessmentFields(lessonOptions),
      initial: data,
      onSubmit: (v) => save('PATCH', `/assessments/${data.id}`, assessmentBody(v), tr("تم حفظ الإعدادات")),
    }))
  }

  const addQuestion = () => setQuestionCfg(newCfg({
    title: tr("إضافة سؤال"),
    initial: newQuestion(),
    onSubmit: (p) => save('POST', `/assessments/${data.id}/questions`,
      { ...p, order_index: data.questions.length + 1 }, tr("تمت إضافة السؤال")),
  }))

  const editQuestion = (q) => setQuestionCfg(newCfg({
    title: tr("تعديل السؤال"),
    initial: q,
    onSubmit: (p) => save('PUT', `/assessments/questions/${q.id}`, { ...p, order_index: q.order_index }, tr("تم حفظ السؤال")),
  }))

  const deleteQuestion = (q) => setConfirmCfg(newCfg({
    title: tr("حذف السؤال"),
    message: tr("هل تريد حذف هذا السؤال؟"),
    confirmLabel: tr("حذف"),
    danger: true,
    onConfirm: async () => {
      await api(`/assessments/questions/${q.id}`, { method: 'DELETE' })
      toast.success(tr("تم حذف السؤال"))
      reload()
    },
  }))

  async function togglePublish() {
    try {
      await api(`/assessments/${data.id}`, { method: 'PATCH', body: { is_published: !data.is_published } })
      toast.success(data.is_published ? tr("تم إلغاء نشر الاختبار") : tr("تم نشر الاختبار للطلاب"))
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      {data && (
        <Link className="link-back" to={`/academy/courses/${data.course_id}`}>
          <Icon name="arrowRight" size={16} />{' '}{tr("الرجوع للكورس")}</Link>
      )}

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <PageHeader
              title={data.title}
              subtitle={[
                KIND_LABELS[data.kind],
                data.time_limit_minutes ? tr("{time_limit_minutes} دقيقة", { time_limit_minutes: data.time_limit_minutes }) : tr("بدون وقت"),
                tr("النجاح {passing_score}%", { passing_score: data.passing_score }),
                tr("{max_attempts} محاولة", { max_attempts: data.max_attempts }),
              ].join(' · ')}
              actions={
                <>
                  <button className="btn btn-ghost" type="button" onClick={openSettings}>
                    <Icon name="edit" size={16} />{' '}{tr("الإعدادات")}</button>
                  <button className="btn btn-primary" type="button" onClick={togglePublish}>
                    {data.is_published ? tr("إلغاء النشر") : tr("نشر للطلاب")}
                  </button>
                </>
              }
            />

            <p>
              <span className={`badge ${data.is_published ? 'badge-ok' : 'badge-muted'}`}>
                {data.is_published ? tr("منشور") : tr("مسودة")}
              </span>
              <span className="chip mr-6">{data.questions.length}{' '}{tr("سؤال")}</span>
            </p>

            {data.is_locked && (
              <div className="alert alert-warn">{tr("بدأ طلاب في حل هذا الاختبار، فالأسئلة مقفولة للتعديل علشان نتايجهم ما تتغيرش. لو محتاج تعديل، أنشئ اختباراً جديداً.")}</div>
            )}

            <div className="tabs" role="tablist">
              {[['questions', tr("الأسئلة")], ['results', tr("النتائج")]].map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k}
                        className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'questions' ? (
              <>
                <div className="toolbar">
                  <button className="btn btn-primary" type="button" onClick={addQuestion} disabled={data.is_locked}>
                    <Icon name="plus" size={18} />{' '}{tr("إضافة سؤال")}</button>
                </div>

                {data.questions.length === 0 ? (
                  <div className="card empty-state">
                    <h2>{tr("لا توجد أسئلة بعد")}</h2>
                    <p className="muted">{tr("أضف أول سؤال. لازم سؤال واحد على الأقل قبل النشر.")}</p>
                  </div>
                ) : (
                  <div className="units">
                    {data.questions.map((q, i) => (
                      <div className="card question-card" key={q.id}>
                        <div className="question-head">
                          <span className="q-num">{i + 1}</span>
                          <div className="q-text">{q.text}</div>
                          <div className="row-actions">
                            <button className="icon-btn sm" type="button" title={tr("تعديل")} aria-label={tr("تعديل السؤال")}
                                    disabled={data.is_locked} onClick={() => editQuestion(q)}>
                              <Icon name="edit" size={16} />
                            </button>
                            <button className="icon-btn sm" type="button" title={tr("حذف")} aria-label={tr("حذف السؤال")}
                                    disabled={data.is_locked} onClick={() => deleteQuestion(q)}>
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="q-meta">
                          <span className="badge badge-muted">{q.kind === 'mcq' ? tr("اختيار من متعدد") : tr("صح أو خطأ")}</span>
                          <span className="chip">{q.points}{' '}{tr("درجة")}</span>
                        </div>
                        <ul className="q-choices">
                          {q.choices.map((c) => (
                            <li key={c.id} className={c.is_correct ? 'correct' : ''}>
                              {c.is_correct && <Icon name="check" size={16} />} {c.text}
                            </li>
                          ))}
                        </ul>
                        {q.explanation && <p className="muted">💡 {q.explanation}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <ResultsTab assessmentId={data.id} />
            )}
          </>
        )}
      </AsyncBlock>

      <FormModal config={formCfg} onClose={() => setFormCfg(null)} />
      <QuestionModal config={questionCfg} onClose={() => setQuestionCfg(null)} />
      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  )
}

function ResultsTab({ assessmentId }) {
  const [page, setPage] = useState(1)
  const limit = 30
  const { data, loading, error, reload } = useApi(
    () => api(`/assessments/${assessmentId}/attempts?page=${page}&limit=${limit}`),
    [assessmentId, page],
  )

  return (
    <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <div className="stats stats-4">
            <div className="card stat-card"><div><div className="stat-value">{data.summary.attempts}</div><div className="muted">{tr("محاولة")}</div></div></div>
            <div className="card stat-card"><div><div className="stat-value">{data.summary.students}</div><div className="muted">{tr("طالب")}</div></div></div>
            <div className="card stat-card"><div><div className="stat-value">{data.summary.average_percentage}%</div><div className="muted">{tr("متوسط الدرجات")}</div></div></div>
            <div className="card stat-card"><div><div className="stat-value">{data.summary.pass_rate}%</div><div className="muted">{tr("نسبة النجاح")}</div></div></div>
          </div>

          <div className="card">
            {data.items.length === 0 ? (
              <div className="empty-state"><h2>{tr("لا توجد نتائج بعد")}</h2></div>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>{tr("الطالب")}</th><th>{tr("المحاولة")}</th><th>{tr("الدرجة")}</th><th>{tr("النسبة")}</th><th>{tr("النتيجة")}</th><th>{tr("الوقت")}</th></tr>
                    </thead>
                    <tbody>
                      {data.items.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.student_name}</strong></td>
                          <td>{r.attempt_number}</td>
                          <td>{r.score} / {r.max_score}</td>
                          <td>{r.percentage}%</td>
                          <td>
                            <span className={`badge ${r.is_passed ? 'badge-ok' : 'badge-bad'}`}>{r.is_passed ? tr("ناجح") : tr("لم ينجح")}</span>
                            {r.status === 'expired' && <span className="badge badge-muted mr-6">{STATUS_LABELS.expired}</span>}
                          </td>
                          <td className="muted">{formatDateTime(r.submitted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} limit={limit} total={data.total} onChange={setPage} />
              </>
            )}
          </div>
        </>
      )}
    </AsyncBlock>
  )
}
