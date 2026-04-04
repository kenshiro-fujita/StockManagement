import { Loader2 } from 'lucide-react';

export default function CompareLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-muted-foreground">読み込み中...</span>
    </div>
  );
}
