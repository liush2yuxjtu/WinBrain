import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'
import { hasConfiguredPasswordUser } from '@/lib/auth-users'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

async function loginAction(formData: FormData) {
  'use server'

  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/'
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/login?error=CredentialsSignin')
    }

    throw error
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth()
  if (session?.user) {
    redirect('/')
  }

  const params = await searchParams
  const authConfigured = hasConfiguredPasswordUser()
  const hasError = Boolean(params.error)

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <span className="badge">Business Skill Studio</span>
          <h1>登录 WinBrain</h1>
          <p>使用管理员配置的邮箱和密码进入业务 skill 工作台。</p>
        </div>

        {!authConfigured ? (
          <div className="auth-warning" role="alert">
            认证尚未配置。请设置 <code>AUTH_USER_EMAIL</code>、<code>AUTH_USER_PASSWORD_HASH</code> 和 <code>AUTH_SECRET</code> 后再登录。
          </div>
        ) : null}

        {hasError ? (
          <div className="auth-error" role="alert">
            邮箱或密码不正确。
          </div>
        ) : null}

        <form action={loginAction} className="auth-form">
          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="admin@example.com" />
          </div>

          <div className="field">
            <label htmlFor="password">密码</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>

          <button className="primary" type="submit" disabled={!authConfigured}>登录</button>
        </form>
      </section>
    </main>
  )
}
