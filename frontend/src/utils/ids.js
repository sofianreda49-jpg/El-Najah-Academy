// كل مرة نفتح فيها نافذة بنديها رقم جديد، علشان تبدأ نضيفة (React key)
let n = 0
export const newCfg = (cfg) => ({ ...cfg, _id: ++n })
