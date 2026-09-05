import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Share block for the poll detail page: the canonical URL as a QR code
 * (现场扫码即达) plus a copy-link button. Client-only — `window.location`
 * is read in an effect, so SSR renders the placeholder frame.
 */
export function SharePoll() {
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const link = window.location.href;
    setUrl(link);
    QRCode.toDataURL(link, { margin: 1, width: 320 })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  async function copyLink() {
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("复制这条链接", url);
    }
  }

  return (
    <section className="mt-10 animate-in rounded-xl border border-border bg-surface p-4 fill-mode-both fade-in slide-in-from-bottom-3 duration-500">
      <p className="text-xs font-medium tracking-wide text-muted">分享</p>
      <div className="mt-3 flex items-center gap-4">
        {qr ? (
          <img
            src={qr}
            alt="二维码"
            width={96}
            height={96}
            className="size-24 animate-in rounded-lg bg-white p-1 fade-in duration-500"
          />
        ) : (
          <div className="size-24 animate-pulse rounded-lg bg-surface-2" />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm text-muted">扫码参与，或复制链接分享。</p>
          <Button variant="outline" size="sm" className="self-start" onClick={copyLink}>
            {copied ? "已复制" : "复制链接"}
          </Button>
        </div>
      </div>
    </section>
  );
}
