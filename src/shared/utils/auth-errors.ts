export type AuthErrorContext = 'login' | 'register' | 'passwordRecovery'

type AuthErrorLike = {
  message?: unknown
  code?: unknown
  status?: unknown
  statusCode?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getAuthErrorShape(error: unknown): AuthErrorLike {
  if (!isRecord(error)) {
    return {
      message: error instanceof Error ? error.message : String(error ?? ''),
    }
  }

  return {
    message: error.message,
    code: error.code,
    status: error.status,
    statusCode: error.statusCode,
  }
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toStatus(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function isEmailRateLimitError(error: unknown) {
  const shape = getAuthErrorShape(error)
  const message = toText(shape.message).toLowerCase()
  const code = toText(shape.code).toLowerCase()
  const status = toStatus(shape.status) ?? toStatus(shape.statusCode)

  return (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('email rate') ||
    message.includes('too many requests') ||
    message.includes('429')
  )
}

function getRateLimitMessage(context: AuthErrorContext) {
  if (context === 'register') {
    return 'Se alcanzó el límite de envío de emails de confirmación. Esperá unos minutos e intentá nuevamente.'
  }

  if (context === 'passwordRecovery') {
    return 'Se alcanzó el límite de envío de emails de recuperación. Esperá unos minutos e intentá nuevamente.'
  }

  return 'Se alcanzó el límite de envío de emails. Esperá unos minutos e intentá nuevamente. Si el problema continúa, contactanos.'
}

export function translateAuthError(error: unknown, context: AuthErrorContext = 'login') {
  if (isEmailRateLimitError(error)) {
    return getRateLimitMessage(context)
  }

  const message = toText(getAuthErrorShape(error).message).trim()

  return message || 'No se pudo completar la operación. Intentá nuevamente.'
}
