import React, { useEffect } from 'react';
import { ArrowLeft, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildPublicSupportMailto, getPublicSupportEmail } from '@/lib/publicContactConfig';

const PAGE_TITLE = 'Delete Your Kronox Account | Kronox';
const PAGE_DESCRIPTION = 'Learn how to delete your Kronox account in the app or request account deletion through the configured support contact.';

function upsertMetaDescription(content) {
  if (typeof document === 'undefined') return;
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export default function AccountDeletionPage() {
  const supportEmail = getPublicSupportEmail();
  const accountDeletionMailto = buildPublicSupportMailto({ subject: 'Account Deletion Request' });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousTitle = document.title;
    const previousDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    document.title = PAGE_TITLE;
    upsertMetaDescription(PAGE_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      upsertMetaDescription(previousDescription);
    };
  }, []);



  return (
    <main
      className="min-h-screen overflow-x-hidden text-white"
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(ellipse at 50% 12%, #12336f 0%, #0a1b3f 42%, #060f2b 72%, #030712 100%)',
      }}
    >
      <div
        className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8"
        style={{
          minHeight: '100dvh',
          paddingTop: 'calc(2rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
      >
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 font-inter text-sm font-bold text-amber-100 shadow-lg shadow-black/20 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-amber-300"
            aria-label="Back to Kronox home"
          >
            <ArrowLeft className="h-4 w-4" />
            Kronox
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/35 bg-amber-300/12 shadow-[0_0_28px_rgba(250,204,21,0.16)]">
            <Trash2 className="h-7 w-7 text-amber-200" aria-hidden="true" />
          </div>

          <p className="font-inter text-xs font-black uppercase tracking-[0.22em] text-amber-200/80">
            Account Deletion
          </p>
          <h1 className="mt-3 font-inter text-4xl font-black leading-tight text-white sm:text-5xl">
            Delete Your Kronox Account
          </h1>

          <div className="mt-8 space-y-5 font-inter text-base leading-7 text-blue-50/90 sm:text-lg">
            <p>
              Kronox users can delete their account directly inside the app by going to Profile and selecting
              {' '}<strong className="font-extrabold text-white">“Hesabı Sil” / “Delete Account”</strong>.
            </p>
            <p>
              If you cannot access the app, you can request account deletion from the email address linked to your
              Kronox account through the configured Kronox support contact.
              {supportEmail && accountDeletionMailto ? (
                <>
                  {' '}
                  <a
                    className="font-extrabold text-amber-200 underline decoration-amber-200/40 underline-offset-4"
                    href={accountDeletionMailto}
                  >
                    {supportEmail}
                  </a>
                </>
              ) : null}
            </p>
            <p>
              When your deletion request is processed, your Kronox account and associated user data will be deleted.
              Some limited records may be retained only when required for security, fraud prevention, legal obligations,
              or abuse prevention.
            </p>
            <p>
              Please include <strong className="font-extrabold text-white">“Account Deletion Request”</strong> in the
              email subject.
            </p>
          </div>

          <div className="mt-9 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/20">
            <div className="mb-3 flex items-center gap-2 text-amber-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <h2 className="font-inter text-lg font-black">Türkçe</h2>
            </div>
            <div className="space-y-4 font-inter text-sm leading-6 text-blue-50/90 sm:text-base">
              <p>
                Kronox hesabınızı uygulama içinde Profil bölümünden{' '}
                <strong className="font-extrabold text-white">“Hesabı Sil”</strong> seçeneğiyle silebilirsiniz.
              </p>
              <p>
                Uygulamaya erişemiyorsanız, Kronox hesabınıza bağlı e-posta adresinden{' '}
                yapılandırılmış Kronox destek iletişim kanalına hesap silme talebi gönderebilirsiniz.
                {supportEmail && accountDeletionMailto ? (
                  <>
                    {' '}
                    <a
                      className="font-extrabold text-amber-200 underline decoration-amber-200/40 underline-offset-4"
                      href={accountDeletionMailto}
                    >
                      {supportEmail}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="mt-7 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-50">
            <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-200" aria-hidden="true" />
            <p className="font-inter text-sm leading-6">
              Requests must be sent from the email linked to the Kronox account so the account owner can be verified.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
