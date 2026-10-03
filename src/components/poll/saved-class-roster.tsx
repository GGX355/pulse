import { useQuery } from '@tanstack/react-query';
import { pulseRequest } from '@/lib/poll-submit';
import { Button } from '@/components/ui/button';

export function SavedClassRoster({onUse}: {onUse: (names: string[]) => void}) {
  const {data,error} = useQuery({
    queryKey:['class-roster'],
    queryFn:()=>pulseRequest<{name:string;names:string[]}|null>('getClassRoster',{}),
    enabled:!!import.meta.env.VITE_CF_APP,
    staleTime:30000,
  });
  if(error) return <p role="status" className="text-xs text-muted">班级名单暂时无法加载</p>;
  if(!data?.names.length) return null;
  return <details className="rounded-xl border border-border p-3">
    <summary className="cursor-pointer">{data.name} · {data.names.length} 人</summary>
    <p className="my-3 text-sm leading-7">{data.names.join('、')}</p>
    <Button type="button" variant="outline" onClick={()=>onUse(data.names)}>使用班级名单</Button>
  </details>;
}
