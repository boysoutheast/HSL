import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Data Deletion — Boy Tenggara AI',
  description: 'Request deletion of your Facebook login data from Boy Tenggara AI.',
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
        <h1 className="text-xl font-bold text-stone-900 mb-2">
          User Data Deletion Instructions
        </h1>
        <p className="text-sm text-stone-600 mb-6 leading-relaxed">
          If you logged in to <strong>Boy Tenggara AI</strong> using Facebook and want your
          data deleted, please send a deletion request to:
        </p>

        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-6 text-center">
          <code className="text-base font-semibold text-violet-700">
            boy.tenggara@gmail.com
          </code>
        </div>

        <p className="text-sm text-stone-600 mb-4">
          Please include the <strong>email address</strong> used to log in. We will delete
          your Facebook login data, including Facebook user ID, name, email, and related
          login records within <strong>7 business days</strong>.
        </p>

        <hr className="border-stone-200 my-6" />

        <h2 className="text-sm font-bold text-stone-900 mb-3">
          You can also remove the app from your Facebook account:
        </h2>
        <ol className="text-sm text-stone-600 space-y-2 list-decimal pl-5">
          <li>Go to <strong>Facebook Settings</strong>.</li>
          <li>Open <strong>Apps and Websites</strong>.</li>
          <li>Find <strong>Boy Tenggara AI</strong>.</li>
          <li>Click <strong>Remove</strong>.</li>
          <li>Request data deletion if Facebook shows the option.</li>
        </ol>
      </div>
    </div>
  )
}
