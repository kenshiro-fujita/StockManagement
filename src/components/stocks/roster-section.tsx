'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  ROSTER_CATEGORIES,
  ROSTER_CATEGORY_LABELS,
  ROSTER_BADGE_STYLES,
  updateRosterSchema,
  type UpdateRosterInput,
} from '@/lib/schemas/roster';
import type { RosterCategory } from '@/lib/types/roster';
import { updateRosterCategory } from '@/actions/roster';

export function RosterBadge({
  category,
}: {
  category: RosterCategory | null;
}) {
  if (!category) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        未分類
      </Badge>
    );
  }

  const style = ROSTER_BADGE_STYLES[category];
  return (
    <Badge variant="outline" className={style.className}>
      {ROSTER_CATEGORY_LABELS[category]}
    </Badge>
  );
}

export function RosterSection({
  stockId,
  currentCategory,
}: {
  stockId: string;
  currentCategory: RosterCategory | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<UpdateRosterInput>({
    resolver: zodResolver(updateRosterSchema),
    mode: 'onBlur',
    defaultValues: {
      stock_id: stockId,
      category: undefined,
      reason: '',
    },
  });

  const handleSubmit = async (data: UpdateRosterInput) => {
    setIsPending(true);
    const result = await updateRosterCategory(data);
    setIsPending(false);

    if (result.success) {
      toast.success('ロースター分類を更新しました');
      setIsEditing(false);
      form.reset({ stock_id: stockId, category: undefined, reason: '' });
    } else {
      toast.error(result.error ?? '更新に失敗しました');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">ロースター</span>
        <RosterBadge category={currentCategory} />
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            変更
          </Button>
        )}
      </div>

      {isEditing && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-3 rounded-lg border p-4"
          >
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新しいカテゴリ</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="カテゴリを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROSTER_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {ROSTER_CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>変更理由</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="分類を変更する理由を入力してください"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? '保存中...' : '保存'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  form.reset();
                }}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
