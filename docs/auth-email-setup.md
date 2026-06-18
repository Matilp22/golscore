# Hay Fulbo Auth Email Setup

Esta documentación describe la configuración de emails de autenticación en Supabase para Hay Fulbo.

No guardar la contraseña SMTP en el repositorio, `.env.local`, Vercel ni código cliente. La contraseña se configura manualmente en Supabase Authentication -> SMTP Settings.

## Hostinger SMTP

- Host: `smtp.hostinger.com`
- Port: `465`
- User: `cuentas@hayfulbo.com`
- SSL/TLS: enabled
- Sender name: `Hay Fulbo`
- Sender email: `cuentas@hayfulbo.com`

## Supabase URL Configuration

Site URL:

```text
https://hayfulbo.com
```

Redirect URLs:

```text
https://hayfulbo.com/auth/callback
https://hayfulbo.com/restablecer-contrasena
http://localhost:3000/auth/callback
http://localhost:3126/auth/callback
http://localhost:3000/restablecer-contrasena
http://localhost:3126/restablecer-contrasena
```

## Flujo de recuperación

La app llama a `resetPasswordForEmail` con:

```text
https://hayfulbo.com/auth/callback?next=%2Frestablecer-contrasena
```

El botón del email debe usar siempre `{{ .ConfirmationURL }}`. No reemplazarlo por `/perfil`, `/login`, `/restablecer-contrasena` ni una URL hardcodeada, porque Supabase necesita incluir el token de recuperación.

Al tocar el botón del email, Supabase valida el token, vuelve a `/auth/callback`, la app intercambia el `code` por sesión y redirige a `/restablecer-contrasena` para crear la nueva contraseña.

## Reset Password Template

Supabase -> Authentication -> Email Templates -> Reset Password

Subject:

```text
Restablecé tu contraseña de Hay Fulbo
```

HTML:

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#101820;background:#ffffff">
  <div style="margin-bottom:24px">
    <strong style="font-size:22px;color:#0b3d2e">HAY FULBO</strong>
  </div>

  <h1 style="font-size:26px;line-height:1.2;margin:0 0 18px">
    Restablecé tu contraseña
  </h1>

  <p style="font-size:16px;line-height:1.6;color:#374151">
    Recibimos una solicitud para cambiar la contraseña de tu cuenta.
  </p>

  <p style="margin:30px 0">
    <a
      href="{{ .ConfirmationURL }}"
      style="display:inline-block;background:#35e77c;color:#041008;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700"
    >
      Crear nueva contraseña
    </a>
  </p>

  <p style="font-size:14px;line-height:1.6;color:#6b7280">
    Si no solicitaste este cambio, podés ignorar este correo.
  </p>

  <hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb">

  <p style="font-size:13px;color:#6b7280">
    ¿Necesitás ayuda?
    <a href="mailto:cuentas@hayfulbo.com" style="color:#0b7a4b">
      cuentas@hayfulbo.com
    </a>
  </p>
</div>
```

## Confirm Signup Template

Supabase -> Authentication -> Email Templates -> Confirm signup

Subject:

```text
Confirmá tu cuenta de Hay Fulbo
```

HTML:

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#101820;background:#ffffff">
  <div style="margin-bottom:24px">
    <strong style="font-size:22px;color:#0b3d2e">HAY FULBO</strong>
  </div>

  <h1 style="font-size:26px;line-height:1.2;margin:0 0 18px">
    Confirmá tu cuenta
  </h1>

  <p style="font-size:16px;line-height:1.6;color:#374151">
    Confirmá tu email para activar tu cuenta y empezar a usar Hay Fulbo.
  </p>

  <p style="margin:30px 0">
    <a
      href="{{ .ConfirmationURL }}"
      style="display:inline-block;background:#35e77c;color:#041008;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700"
    >
      Confirmar mi cuenta
    </a>
  </p>

  <p style="font-size:14px;line-height:1.6;color:#6b7280">
    Si no creaste esta cuenta, podés ignorar el correo.
  </p>

  <hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb">

  <p style="font-size:13px;color:#6b7280">
    Ayuda:
    <a href="mailto:cuentas@hayfulbo.com" style="color:#0b7a4b">
      cuentas@hayfulbo.com
    </a>
  </p>
</div>
```

## Seguridad

- No guardar la contraseña SMTP en el repositorio.
- No guardar la contraseña SMTP en `.env.local`.
- No guardar la contraseña SMTP en Vercel.
- No exponer `service_role` ni secretos en cliente.
- Mantener Supabase Auth como única fuente de autenticación.
- Configurar SMTP manualmente desde Supabase Authentication -> SMTP Settings.
