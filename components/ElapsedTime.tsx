"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { formatDuration } from "@/lib/format";

type Props = {
  since: string;
  initialSeconds: number;
};

/** Cronômetro de uma guerra em andamento, atualizado sem recarregar a página. */
export function ElapsedTime({ since, initialSeconds }: Props) {
  const { locale } = useT();
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const started = Date.parse(since);
    if (Number.isNaN(started)) return;

    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, [since]);

  return <span className="war-live-clock">{formatDuration(seconds, locale)}</span>;
}
