import { Suspense } from 'react'
import AuthForm from '@/frontend/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-md px-4 py-8">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  )
}
