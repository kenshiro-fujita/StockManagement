'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createStockSchema,
  type CreateStockInput,
  updateStockSchema,
  MARKET_OPTIONS,
  SECTOR_OPTIONS,
} from '@/lib/schemas/stocks';
import { createStock, updateStock } from '@/actions/stocks';
import { lookupStockByCode } from '@/actions/stock-lookup';
import { Loader2, Search } from 'lucide-react';

type StockData = {
  id: string;
  stock_code: string;
  company_name: string;
  market: string | null;
  sector: string | null;
  business_segment: string | null;
};

export function StockForm({ stock }: { stock?: StockData }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const router = useRouter();
  const isEditMode = !!stock;

  const form = useForm<CreateStockInput>({
    resolver: zodResolver(isEditMode ? updateStockSchema : createStockSchema),
    mode: 'onBlur',
    defaultValues: {
      stock_code: stock?.stock_code ?? '',
      company_name: stock?.company_name ?? '',
      market: stock?.market ?? undefined,
      sector: stock?.sector ?? undefined,
      business_segment: stock?.business_segment ?? '',
    },
  });

  const handleLookup = async () => {
    const code = form.getValues('stock_code');
    if (!code || code.length !== 4) {
      toast.error('4桁の証券コードを入力してください');
      return;
    }
    setIsLookingUp(true);
    try {
      const result = await lookupStockByCode(code);
      if (result.success && result.data) {
        form.setValue('company_name', result.data.companyName, {
          shouldDirty: true,
        });
        toast.success(`${result.data.companyName} が見つかりました`);
      } else {
        toast.error(result.error ?? '企業情報の取得に失敗しました');
      }
    } catch {
      toast.error('企業情報の取得に失敗しました');
    } finally {
      setIsLookingUp(false);
    }
  };

  const onSubmit = async (data: CreateStockInput) => {
    setIsLoading(true);

    try {
      const result = isEditMode
        ? await updateStock({ ...data, id: stock.id })
        : await createStock(data);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        isEditMode ? '銘柄情報を更新しました' : '銘柄を登録しました'
      );
      router.push(isEditMode ? `/stocks/${stock.id}` : '/stocks');
    } catch {
      toast.error(
        isEditMode ? '銘柄情報の更新に失敗しました' : '銘柄の登録に失敗しました'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="stock_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                銘柄コード <span className="text-destructive">*</span>
              </FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder="例: 7203" maxLength={4} {...field} />
                </FormControl>
                {!isEditMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLookup}
                    disabled={isLookingUp}
                    className="shrink-0"
                  >
                    {isLookingUp ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-1 h-4 w-4" />
                    )}
                    自動入力
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                証券コードを入力して「自動入力」を押すと、企業名が自動で入力されます
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="company_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                企業名 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="例: トヨタ自動車" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="market"
          render={({ field }) => (
            <FormItem>
              <FormLabel>市場</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MARKET_OPTIONS.map((market) => (
                    <SelectItem key={market} value={market}>
                      {market}
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
          name="sector"
          render={({ field }) => (
            <FormItem>
              <FormLabel>業種</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SECTOR_OPTIONS.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
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
          name="business_segment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>事業セグメント</FormLabel>
              <FormControl>
                <Input placeholder="例: 自動車" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEditMode
                ? '更新中...'
                : '登録中...'
              : isEditMode
                ? '更新する'
                : '銘柄を登録する'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(isEditMode ? `/stocks/${stock.id}` : '/stocks')
            }
          >
            キャンセル
          </Button>
        </div>
      </form>
    </Form>
  );
}
