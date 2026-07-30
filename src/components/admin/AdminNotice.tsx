type AdminNoticeProps = {
  title: string
  message: string
  tone?: 'info' | 'danger'
}

export default function AdminNotice({
  title,
  message,
  tone = 'info',
}: AdminNoticeProps) {
  return (
    <div
      className={`hf-admin-notice is-${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  )
}
