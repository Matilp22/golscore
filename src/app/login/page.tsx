import { Suspense } from 'react'
import AuthForm from '@/frontend/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-md md:px-4 md:py-8">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  )
}
