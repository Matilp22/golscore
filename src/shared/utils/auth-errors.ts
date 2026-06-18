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

function getNormalizedErrorParts(error: unknown) {
  const shape = getAuthErrorShape(error)

  return {
    message: toText(shape.message).trim().toLowerCase(),
    code: toText(shape.code).trim().toLowerCase(),
    status: toStatus(shape.status) ?? toStatus(shape.statusCode),
  }
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

function isEmailRateLimitError(error: unknown) {
  const { message, code, status } = getNormalizedErrorParts(error)

  return (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    includesAny(message, [
      'rate limit',
      'email rate',
      'too many requests',
      '429',
      'over_email_send_rate_limit',
    ])
  )
}

function isExpiredOrInvalidLinkError(error: unknown) {
  const { message, code } = getNormalizedErrorParts(error)

  return (
    code === 'otp_expired' ||
    code === 'access_denied' ||
    code === 'invalid_grant' ||
    includesAny(message, [
      'otp_expired',
      'access_denied',
      'invalid_grant',
      'token expired',
      'invalid token',
      'invalid recovery link',
      'expired recovery link',
      'invalid or expired',
      'expired',
      'code verifier',
      'pkce',
    ])
  )
}

function isSamePasswordError(error: unknown) {
  const { message, code } = getNormalizedErrorParts(error)

  return (
    code === 'same_password' ||
    includesAny(message, [
      'same password',
      'different from the old password',
      'new password should be different',
    ])
  )
}

function isWeakPasswordError(error: unknown) {
  const { message, code } = getNormalizedErrorParts(error)

  return (
    code === 'weak_password' ||
    includesAny(message, [
      'weak password',
      'password should be',
      'password must be',
      'password is too weak',
    ])
  )
}

function getRateLimitMessage(context: AuthErrorContext) {
  if (context === 'register') {
    return 'Se alcanzó el límite de envío de emails de confirmación. Esperá unos minutos e intentá nuevamente.'
  }

  if (context === 'passwordRecovery') {
    return 'Se alcanzó temporalmente el límite de envío de emails. Esperá unos minutos e intentá nuevamente.'
  }

  return 'Se alcanzó el límite de envío de emails. Esperá unos minutos e intentá nuevamente. Si el problema continúa, contactanos.'
}

export function translateAuthError(error: unknown, context: AuthErrorContext = 'login') {
  const { message, code, status } = getNormalizedErrorParts(error)

  if (isEmailRateLimitError(error)) {
    return getRateLimitMessage(context)
  }

  if (isExpiredOrInvalidLinkError(error)) {
    return 'El enlace es inválido o expiró. Solicitá un nuevo enlace para continuar.'
  }

  if (isSamePasswordError(error)) {
    return 'La nueva contraseña tiene que ser distinta a la anterior.'
  }

  if (isWeakPasswordError(error)) {
    return 'La contraseña es demasiado débil. Probá con una más larga y difícil de adivinar.'
  }

  if (
    code === 'invalid_credentials' ||
    includesAny(message, ['invalid login credentials', 'invalid credentials'])
  ) {
    return 'Email o contraseña incorrectos.'
  }

  if (includesAny(message, ['email not confirmed', 'not confirmed'])) {
    return 'Tenés que confirmar tu email antes de iniciar sesión.'
  }

  if (includesAny(message, ['already registered', 'user already registered'])) {
    return 'Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.'
  }

  if (includesAny(message, ['invalid email', 'email address is invalid'])) {
    return 'Ingresá un email válido.'
  }

  if (status === 400 && context === 'passwordRecovery') {
    return 'No se pudo completar la recuperación. Solicitá un nuevo enlace e intentá nuevamente.'
  }

  return 'No se pudo completar la operación. Intentá nuevamente.'
}
