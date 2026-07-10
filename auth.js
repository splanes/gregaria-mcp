// NextAuth v5 — SOLO Google, con allowlist. Únicamente para gatear el enroll web.
// Lee AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET del entorno.
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isEmailAllowed(email) {
  if (!email) return false
  const e = email.toLowerCase()
  if (process.env.ADMIN_EMAIL && e === process.env.ADMIN_EMAIL.toLowerCase()) return true
  return allowedEmails().includes(e)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      return isEmailAllowed(user?.email) ? true : "/connect?denied=1"
    },
  },
  pages: { signIn: "/connect" },
})
