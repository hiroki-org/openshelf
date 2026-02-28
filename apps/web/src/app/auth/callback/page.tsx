"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
    }
    router.replace("/");
  }, [router]);
  return <p>ログイン中...</p>;
}
