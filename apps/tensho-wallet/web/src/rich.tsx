import { Fragment, type ReactNode } from "react";

const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Models cite sources as markdown links; show each as a small source tag instead of a raw URL.
export function richText(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, , url] = match;
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      <a
        key={`${match.index}-${url}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mx-0.5 rounded-full border border-edge px-1.5 py-px align-[1px] text-[11px] text-muted no-underline hover:border-text hover:text-text"
      >
        {hostOf(url!)}
      </a>,
    );
    last = match.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}
