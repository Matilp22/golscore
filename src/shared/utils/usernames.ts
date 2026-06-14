export const MIN_USERNAME_LENGTH = 3
export const MAX_USERNAME_LENGTH = 40

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value)

  if (username.length < MIN_USERNAME_LENGTH) {
    return {
      username,
      error: `El nombre de usuario debe tener al menos ${MIN_USERNAME_LENGTH} caracteres.`,
    }
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    return {
      username,
      error: `El nombre de usuario no puede superar los ${MAX_USERNAME_LENGTH} caracteres.`,
    }
  }

  return {
    username,
    error: null,
  }
}
