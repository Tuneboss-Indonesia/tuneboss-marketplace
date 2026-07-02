import { useForm } from '@tanstack/react-form'
import { Eye, EyeOff, Lock, Mail, Phone, Save, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApi, useApiMutation } from '../hooks/useApi'
import { QueryProvider } from './QueryProvider'

type AccountResponse = { user: { name: string; email: string; phone?: string | null } }

const inputClass = 'w-full border border-primary/20 bg-transparent p-4 pl-12 outline-none transition-colors focus:border-primary text-foreground'
const disabledInputClass = 'w-full border border-primary/20 bg-primary/5 p-4 pl-12 outline-none transition-colors text-foreground/60 cursor-not-allowed'
const errorClass = 'text-[11px] font-medium text-red-500 mt-1.5 px-1'

function FieldError({ errors }: { errors: unknown[] }) {
  if (errors.length === 0) return null
  return <p className={errorClass}>{errors.map(String).join(', ')}</p>
}

function PasswordInput({ field, label, placeholder }: { field: { name: string; state: { value: string; meta: { errors: unknown[] } }; handleBlur: () => void; handleChange: (value: string) => void }; label: string; placeholder: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="grid gap-2">
      <label htmlFor={field.name} className="text-sm font-bold uppercase tracking-widest text-foreground">{label}</label>
      <div className="relative">
        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50" />
        <input id={field.name} name={field.name} aria-label={label} type={visible ? 'text' : 'password'} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder={placeholder} className={`${inputClass} pr-12`} />
        <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 transition-colors hover:text-primary" aria-label="Toggle password visibility" onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <FieldError errors={field.state.meta.errors} />
    </div>
  )
}

function Forms() {
  const account = useApi<AccountResponse>('/account')
  const saveProfile = useApiMutation<AccountResponse>('/account', 'PATCH')
  const savePassword = useApiMutation<{ ok: boolean }>('/account/password', 'PATCH')
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const profile = useForm({
    defaultValues: { name: account.data?.user.name ?? '', phone: account.data?.user.phone ?? '' },
    onSubmit: async ({ value }) => {
      setProfileMessage('')
      await saveProfile.mutateAsync({ name: value.name.trim(), phone: value.phone.trim() })
      setProfileMessage('Profil berhasil disimpan.')
    },
  })

  const password = useForm({
    defaultValues: { current: '', next: '', confirm: '' },
    onSubmit: async ({ value, formApi }) => {
      setPasswordMessage('')
      if (value.next !== value.confirm) {
        setPasswordMessage('Konfirmasi kata sandi tidak cocok.')
        return
      }
      await savePassword.mutateAsync({ currentPassword: value.current, newPassword: value.next })
      formApi.reset()
      setPasswordMessage('Kata sandi berhasil diperbarui.')
    },
  })

  useEffect(() => {
    if (!account.data?.user) return
    profile.reset({ name: account.data.user.name ?? '', phone: account.data.user.phone ?? '' })
  }, [account.data?.user, profile])

  if (account.isLoading) return <div className="py-8 text-sm text-foreground/70">Memuat profil...</div>
  if (account.error) return <div className="border border-red-500/20 p-6 text-sm text-red-500">Gagal memuat profil. Silakan login ulang.</div>

  return (
    <>
      <section className="mb-12">
        <div className="mb-8">
          <h2 data-i18n="account.profileTitle" className="text-xl font-bold uppercase tracking-widest text-foreground">Profil Saya</h2>
          <p data-i18n="account.profileDesc" className="mt-1 text-sm text-foreground/70">Kelola informasi pribadi dan kontak Anda.</p>
        </div>

        <form className="space-y-5" action={() => { void profile.handleSubmit() }}>
          <profile.Field name="name" validators={{ onChange: ({ value }) => value.trim().length >= 3 ? undefined : 'Nama minimal 3 karakter' }}>
            {(field) => (
            <div className="grid gap-2">
              <label htmlFor={field.name} data-i18n="account.name" className="text-sm font-bold uppercase tracking-widest text-foreground">Nama Lengkap</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50" />
                <input id={field.name} name={field.name} aria-label="Nama Lengkap" type="text" value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="Masukkan nama lengkap Anda" className={inputClass} />
              </div>
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
          </profile.Field>

          <div className="grid gap-2">
            <label htmlFor="profile-email" data-i18n="account.email" className="text-sm font-bold uppercase tracking-widest text-foreground">Alamat Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50" />
              <input id="profile-email" type="email" disabled readOnly value={account.data?.user.email ?? ''} className={disabledInputClass} />
            </div>
            <p data-i18n="account.emailHelp" className="text-[11px] uppercase tracking-widest text-foreground/60">Alamat email tidak dapat diubah.</p>
          </div>

          <profile.Field name="phone" validators={{ onChange: ({ value }) => value.trim().length >= 9 ? undefined : 'Nomor telepon tidak valid' }}>
            {(field) => (
            <div className="grid gap-2">
              <label htmlFor={field.name} data-i18n="account.phone" className="text-sm font-bold uppercase tracking-widest text-foreground">Nomor Telepon</label>
              <div className="relative">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50" />
                <input id={field.name} name={field.name} aria-label="Nomor Telepon" type="tel" value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="Masukkan nomor telepon Anda" className={inputClass} />
              </div>
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
          </profile.Field>

          <profile.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
            <button type="submit" disabled={!canSubmit || saveProfile.isPending} className="mt-4 flex items-center justify-center gap-3 bg-primary px-8 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#c95b04] disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={18} />
              <span data-i18n="account.saveProfile">{isSubmitting || saveProfile.isPending ? 'Menyimpan...' : 'Simpan Profil'}</span>
            </button>
          )}
          </profile.Subscribe>
          {(profileMessage || saveProfile.error) && <p className={saveProfile.error ? errorClass : 'text-[11px] font-medium text-green-600 mt-1.5 px-1'}>{saveProfile.error ? (saveProfile.error as Error).message : profileMessage}</p>}
        </form>
      </section>

      <hr className="border-border/50 my-8" />

      <section>
        <div className="mb-8">
          <h2 data-i18n="account.passwordTitle" className="text-xl font-bold uppercase tracking-widest text-foreground">Ubah Kata Sandi</h2>
          <p data-i18n="account.passwordDesc" className="mt-1 text-sm text-foreground/70">Perbarui kata sandi Anda untuk menjaga keamanan akun.</p>
        </div>

        <form className="space-y-5" action={() => { void password.handleSubmit() }}>
          <password.Field name="current" validators={{ onChange: ({ value }) => value.length >= 6 ? undefined : 'Kata sandi minimal 6 karakter' }}>{(field) => <PasswordInput field={field} label="Kata Sandi Saat Ini" placeholder="Masukkan kata sandi saat ini" />}</password.Field>
          <password.Field name="next" validators={{ onChange: ({ value }) => value.length >= 6 ? undefined : 'Kata sandi minimal 6 karakter' }}>{(field) => <PasswordInput field={field} label="Kata Sandi Baru" placeholder="Masukkan kata sandi baru" />}</password.Field>
          <password.Field name="confirm" validators={{ onChange: ({ value }) => value.length >= 6 ? undefined : 'Kata sandi minimal 6 karakter' }}>{(field) => <PasswordInput field={field} label="Konfirmasi Kata Sandi Baru" placeholder="Ulangi kata sandi baru" />}</password.Field>

          <password.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
            <button type="submit" disabled={!canSubmit || savePassword.isPending} className="mt-4 flex items-center justify-center gap-3 bg-primary px-8 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#c95b04] disabled:cursor-not-allowed disabled:opacity-60">
              <Lock size={18} />
              <span data-i18n="account.updatePassword">{isSubmitting || savePassword.isPending ? 'Memperbarui...' : 'Perbarui Kata Sandi'}</span>
            </button>
          )}
          </password.Subscribe>
          {(passwordMessage || savePassword.error) && <p className={savePassword.error || passwordMessage.includes('tidak cocok') ? errorClass : 'text-[11px] font-medium text-green-600 mt-1.5 px-1'}>{savePassword.error ? (savePassword.error as Error).message : passwordMessage}</p>}
        </form>
      </section>
    </>
  )
}

export default function AccountSettingsForms() {
  return <QueryProvider><Forms /></QueryProvider>
}
