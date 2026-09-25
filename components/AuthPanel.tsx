"use client";

import { useState } from "react";
import { jpost, type User } from "@/lib/api";

export default function AuthPanel({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");
    const path = register ? "/api/auth/register" : "/api/auth/login";
    const body = register ? { name, email, password } : { name, password };
    const { status, data } = await jpost<{ user?: User; error?: string }>(path, body);
    if (status !== 200 || !data.user) {
      setMsg(data.error ?? "Something went wrong.");
      return;
    }
    onAuthed(data.user);
  }

  return (
    <div className="authwrap">
      <div className="stack authcard">
        <span className="big">{register ? "Create account" : "Sign in"}</span>
        <label className="field">
          <span>username</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        {register && (
          <label className="field">
            <span>
              email <em>(optional)</em>
            </span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>
        {register && <p className="fieldhint">8+ characters, with at least one letter and one number.</p>}
        <div className="notice">{msg}</div>
        <div className="row">
          <button className="btn primary" onClick={submit}>
            {register ? "Create account" : "Sign in"}
          </button>
          <button className="linkbtn" onClick={() => setRegister((r) => !r)}>
            {register ? "have an account? sign in" : "new here? create account"}
          </button>
        </div>
      </div>
    </div>
  );
}
