import { Suspense } from 'react'
import AuthForm from '@/frontend/components/auth/AuthForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-md px-4 py-8">
        <Suspense fallback={null}>
          <AuthForm mode="register" />
        </Suspense>
      </div>
    </div>
  )
}
