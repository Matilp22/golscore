export const AUTH_PASSWORD_MIN_LENGTH = 6

export function validateAuthPassword(password: string, repeatedPassword?: string) {
  if (!password) {
    return 'Ingresá una contraseña.'
  }

  if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`
  }

  if (repeatedPassword !== undefined && password !== repeatedPassword) {
    return 'Las contraseñas no coinciden.'
  }

  return null
}
