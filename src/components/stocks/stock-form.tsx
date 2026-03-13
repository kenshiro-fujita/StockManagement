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
  MARKET_OPTIONS,
  SECTOR_OPTIONS,
} from '@/lib/schemas/stocks';
import { createStock } from '@/actions/stocks';

export function StockForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<CreateStockInput>({
    resolver: zodResolver(createStockSchema),
    mode: 'onBlur',
    defaultValues: {
      stock_code: '',
      company_name: '',
      market: undefined,
      sector: undefined,
      business_segment: '',
    },
  });

  const onSubmit = async (data: CreateStockInput) => {
    setIsLoading(true);

    try {
      const result = await createStock(data);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('銘柄を登録しました');
      router.push('/stocks');
    } catch {
      toast.error('銘柄の登録に失敗しました');
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
              <FormControl>
                <Input placeholder="例: 7203" {...field} />
              </FormControl>
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
            {isLoading ? '登録中...' : '銘柄を登録する'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/stocks')}
          >
            キャンセル
          </Button>
        </div>
      </form>
    </Form>
  );
}
