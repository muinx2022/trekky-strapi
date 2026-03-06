"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-context";

function GoogleCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const googleToken = searchParams.get("access_token");
    if (!googleToken) {
      setError("Không nhận được token từ Google.");
      return;
    }

    (async () => {
      // Exchange Google's access_token for a Strapi JWT
      const res = await fetch(
        `/api/google-auth-proxy?access_token=${encodeURIComponent(googleToken)}`
      );
      const data = (await res.json()) as { jwt?: string; error?: { message?: string } };

      if (!res.ok || !data.jwt) {
        setError(data.error?.message ?? "Đăng nhập Google thất bại.");
        return;
      }

      const err = await loginWithToken(data.jwt);
      if (err) {
        setError(err);
      } else {
        router.replace("/");
      }
    })();
  }, [searchParams, loginWithToken, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={() => router.replace("/")}
            className="text-sm text-blue-600 hover:underline"
          >
            Quay về trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <svg className="animate-spin mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <p className="text-sm text-zinc-500">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
    }>
      <GoogleCallbackInner />
    </Suspense>
  );
}
