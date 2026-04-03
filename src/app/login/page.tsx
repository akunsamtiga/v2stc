'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (localStorage.getItem('stc_token')) router.push('/dashboard');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      localStorage.setItem('stc_token', res.accessToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4 py-10">
      <div className="w-full max-w-[360px]">

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] tracking-[-0.5px] leading-snug">
            Selamat datang
          </h1>
          <p className="text-[13px] text-[#86868b] mt-1.5 tracking-[-0.1px]">
            Masuk ke akun Stockity kamu
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[18px] px-7 py-8 border border-black/[0.08]">

          {/* Email */}
          <div className="mb-3">
            <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-[0.06em] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="nama@contoh.com"
              className="w-full bg-[#f9f9f9] border border-black/10 rounded-[10px]
                         px-3.5 py-[11px] text-[14px] text-[#1d1d1f] placeholder-[#c7c7cc]
                         outline-none transition-all appearance-none
                         focus:bg-white focus:border-black/[0.28] focus:ring-[3px] focus:ring-black/[0.06]"
            />
          </div>

          {/* Password */}
          <div className="mb-1">
            <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-[0.06em] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-[#f9f9f9] border border-black/10 rounded-[10px]
                         px-3.5 py-[11px] text-[14px] text-[#1d1d1f] placeholder-[#c7c7cc]
                         outline-none transition-all appearance-none
                         focus:bg-white focus:border-black/[0.28] focus:ring-[3px] focus:ring-black/[0.06]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200/50
                            rounded-[10px] px-3 py-2.5 mt-3">
              <span className="w-[5px] h-[5px] rounded-full bg-red-500 flex-shrink-0 mt-[5px]" />
              <p className="text-[12.5px] text-red-600 leading-snug">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            onClick={handleLogin as any}
            disabled={loading}
            className="w-full mt-5 bg-[#1d1d1f] text-white font-medium text-[14px]
                       tracking-[-0.2px] rounded-[11px] py-[12.5px] transition-all
                       hover:opacity-85 active:scale-[0.988]
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-[7px]">
                <span className="w-[13px] h-[13px] rounded-full border-[1.5px]
                                 border-white/25 border-t-white animate-spin" />
                Masuk...
              </span>
            ) : 'Masuk'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[11.5px] text-[#aeaeb2] mt-5 leading-relaxed">
          © 2025 Stockity ·{' '}
          <span className="text-[#1d1d1f] underline underline-offset-2 cursor-pointer">
            Ketentuan Layanan
          </span>
        </p>

      </div>
    </div>
  );
}
