// عنوان عمود قابل للفرز (بيدعم قارئات الشاشة بـ aria-sort)
export default function SortHeader({ field, sort, order, onSort, children }) {
  const active = sort === field
  return (
    <th aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`sort-btn${active ? ' active' : ''}`} onClick={() => onSort(field)}>
        {children}
        <span className="sort-ind" aria-hidden="true">{active ? (order === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}
