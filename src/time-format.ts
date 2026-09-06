// ISO(UTC) → 进程/浏览器本地时区文本：存储保持 UTC，仅展示层转换。
// 此前 UI 与工具输出对 ISO 裸切片（slice+replace）把 UTC 原样展示，UTC+8 晚 8 小时。
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD HH:mm:ss"；空值返回空串，非法输入原样返回。 */
export function formatLocal(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
