// بيضيف data-label لكل خلية في الجداول (من عنوان العمود) عشان CSS الموبايل يعرض الصفوف ككروت.
// إضافة خصائص HTML بس: ما بيغيّر محتوى ولا سلوك، وما له أي أثر على شكل الديسكتوب.

function labelTables() {
  document.querySelectorAll('table').forEach((table) => {
    const heads = Array.from(table.querySelectorAll('thead th')).map((th) => {
      const copy = th.cloneNode(true)
      copy.querySelectorAll('.sort-ind').forEach((n) => n.remove()) // سهم الترتيب مش جزء من اسم العمود
      return (copy.textContent || '').trim()
    })
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => {
        if (cell.tagName !== 'TD') return
        const text = cell.hasAttribute('colspan') ? '' : heads[i] || ''
        if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text)
      })
    })
  })
}

let queued = false
function schedule() {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    labelTables()
  })
}

if (typeof window !== 'undefined' && 'MutationObserver' in window) {
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
  })
  schedule()
}
