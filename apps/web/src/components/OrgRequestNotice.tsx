import type { OrgRequestMine } from '@brett-und-blatt/online';
import { useEffect, useState } from 'react';
import { hasAppliedForOrg, loadMyOrgRequests, markOrgSeen, unseenOrgDecisions } from '../lib/orgServer';
import { Button } from './controls';

/**
 * Hinweis beim nächsten Öffnen (#228): Wer einen Antrag auf eine Organisation gestellt hat, erfährt hier, ob er freigegeben oder
 * abgelehnt wurde. Das Gerät fragt nur nach, wenn es einen Antrag gestellt hat, und zeigt jede Entscheidung einmal.
 */
export function OrgRequestNotice() {
  const [news, setNews] = useState<OrgRequestMine[]>([]);

  useEffect(() => {
    if (!hasAppliedForOrg()) return;
    let alive = true;
    void loadMyOrgRequests().then((requests) => alive && setNews(unseenOrgDecisions(requests)));
    return () => {
      alive = false;
    };
  }, []);

  if (news.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Antrag auf eine Organisation">
      {news.map((request) => (
        <div key={request.id} role="status" className="space-y-1 rounded-xl border border-line bg-surface-2 p-3 text-sm">
          {request.status === 'approved' ? (
            <p>
              ✅ Deine Organisation „{request.orgName}“ ist freigegeben. Du bist ihr Betreiber. Code: <span className="font-semibold tracking-wide">{request.code}</span>
            </p>
          ) : (
            <p>
              ❌ Dein Antrag für „{request.orgName}“ wurde abgelehnt.{request.note ? ` Anmerkung: ${request.note}` : ''}
            </p>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          markOrgSeen(news.map((r) => r.id));
          setNews([]);
        }}
      >
        Verstanden
      </Button>
    </section>
  );
}
