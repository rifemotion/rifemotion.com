"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import "../admin.css";

function LoginForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/admin");
    }
  }, [status, router]);

  return (
    <div className="loginCard">
      <div className="loginLogo">R</div>
      <h1 className="loginTitle">rifemotion admin</h1>
      <p className="loginSubtitle">1-Click Secure Management Portal</p>

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            borderRadius: "10px",
            padding: "0.75rem 1rem",
            fontSize: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          {error === "AccessDenied"
            ? "Access Denied: Your Google account is not in the authorized administrator whitelist."
            : `Login error: ${error}`}
        </div>
      )}

      <button
        type="button"
        className="btnGoogle"
        onClick={() => signIn("google", { callbackUrl: "/admin" })}
      >
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>Continue with Google</span>
      </button>

      <p className="loginFooter">
        Protected by Google OAuth 2.0. Session stays signed in for 30 days.
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="loginContainer">
      <Suspense fallback={<div className="loginCard"><p style={{ color: "#9ca3af" }}>Loading...</p></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
