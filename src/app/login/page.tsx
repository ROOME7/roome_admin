// /login — admin sign-in page.
//
// Server component shell + client island for the form. If the visitor already
// has a valid admin session, we bounce them to / before rendering anything.

import { redirect } from 'next/navigation';
import { readAdminSessionOrNull } from '@/lib/auth';
import LoginForm from './login-form';

type SearchParams = Promise<{ redirect?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await readAdminSessionOrNull();
  const params = await searchParams;
  if (session) redirect(params.redirect ?? '/');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">RooMe Admin</h1>
          <p className="mt-1 text-sm text-gray-600">Sign in to manage the platform.</p>
        </header>

        <LoginForm redirectPath={params.redirect ?? '/'} initialError={params.error} />
      </div>
    </main>
  );
}
