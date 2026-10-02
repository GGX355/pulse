import { useEffect, useRef, type ReactNode } from 'react';
import source from '../../../vendor/pulse-final/pulse.html?raw';
import { mountPulse } from '../../../vendor/pulse-final/pulse-runtime.js';
import { createPulseApi } from './api';

// HTML, styles and motion are exact GitHub pulse-final source. Only asset URLs
// are adapted here. Route loaders/APIs remain in the original application.
const body = source.split(/<body[^>]*>/)[1].split('</body>')[0]
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  .replaceAll('href="lab.html"', 'href="/glass-lab/lab.html"')
  .replaceAll('href="pulse.html"', 'href="/"');

export function FinalGlassShell({ children: _children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mounted = mountPulse({ business: createPulseApi() });
    return () => mounted.destroy();
  }, []);
  return <div ref={host} dangerouslySetInnerHTML={{ __html: body }} />;
}
