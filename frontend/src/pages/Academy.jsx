import { useState } from 'react'

import PageHeader from '../components/PageHeader.jsx'
import CoursesTab from './academy/CoursesTab.jsx'
import StructureTab from './academy/StructureTab.jsx'
import { tr } from '../i18n/index.jsx'

const TABS = [
  { key: 'courses', get label() { return tr("الكورسات") } },
  { key: 'structure', get label() { return tr("الهيكل الأساسي") } },
]

export default function Academy() {
  const [tab, setTab] = useState('courses')

  return (
    <>
      <PageHeader title={tr("الأكاديمية")} subtitle={tr("إدارة الكورسات والمحتوى التعليمي والهيكل الأساسي.")} />

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                  className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'courses' ? <CoursesTab /> : <StructureTab />}
    </>
  )
}
