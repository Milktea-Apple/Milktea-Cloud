import Link from "next/link";
import { ArrowLeft, CupSoda } from "lucide-react";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="notfound-page">
      <Brand href="/" size={42} />
      <div className="notfound-card">
        <div className="notfound-art">
          <CupSoda size={40} strokeWidth={1.4} />
          <span className="notfound-pearl p1" />
          <span className="notfound-pearl p2" />
        </div>
        <p className="eyebrow">404 · Not found</p>
        <h1>这杯好像不存在。</h1>
        <p>页面可能被移动或删除了。回到首页，重新点一杯吧。</p>
        <Link href="/" className="btn btn-primary">
          <ArrowLeft size={15} /> 回到首页
        </Link>
      </div>
    </div>
  );
}
