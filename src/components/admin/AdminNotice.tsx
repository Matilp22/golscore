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
  const className =
    tone === 'danger'
      ? 'border-[#ff5f62]/30 bg-[#331414]/70 text-[#ffd5d5]'
      : 'border-[#70ff9d]/20 bg-[#0c1c14]/70 text-[#dce7f2]'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <p className="font-black">{title}</p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
    </div>
  )
}
