"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Brand } from "@/components/brand";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="notfound-page">
      <Brand href="/" size={42} />
      <div className="notfound-card">
        <p className="eyebrow">Something spilled</p>
        <h1>奶茶洒了一点。</h1>
        <p>这个页面遇到了一点问题。可以重试，或者回到首页。</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            <RotateCcw size={15} /> 重试
          </button>
          <Link href="/" className="btn btn-secondary">
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}
