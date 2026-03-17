'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronsUpDown } from 'lucide-react';

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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { type z } from 'zod';
import {
  createFinancialDataSchema,
  FISCAL_QUARTER_OPTIONS,
  FISCAL_QUARTER_LABELS,
  CONSOLIDATION_TYPE_OPTIONS,
  CONSOLIDATION_TYPE_LABELS,
  INPUT_UNIT_OPTIONS,
} from '@/lib/schemas/financial-data';
import { INPUT_UNIT_LABELS } from '@/lib/utils/unit-conversion';
import { createFinancialData } from '@/actions/financial-data';

type FormValues = z.input<typeof createFinancialDataSchema>;

const AMOUNT_FIELDS = [
  { name: 'revenue' as const, label: '売上高', required: true },
  { name: 'operating_income' as const, label: '営業利益', required: true },
  { name: 'net_income' as const, label: '当期純利益', required: true },
  { name: 'total_assets' as const, label: '総資産', required: true },
  { name: 'equity' as const, label: '自己資本', required: true },
] as const;

const OPTIONAL_FIELDS = [
  { name: 'interest_bearing_debt' as const, label: '有利子負債' },
  { name: 'operating_cf' as const, label: '営業キャッシュフロー' },
  { name: 'investing_cf' as const, label: '投資キャッシュフロー' },
  { name: 'shares_outstanding' as const, label: '普通株式数（株）' },
  { name: 'interest_expense' as const, label: '支払利息' },
  { name: 'current_stock_price' as const, label: '現在株価（円）' },
] as const;

// Fields not subject to unit conversion
const NO_CONVERSION_FIELDS = new Set([
  'shares_outstanding',
  'current_stock_price',
]);

export function FinancialDataForm({
  stockId,
  onSuccess,
}: {
  stockId: string;
  onSuccess?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);

  const currentYear = new Date().getFullYear();

  // zodResolver bridges z.input (strings) → z.output (numbers) internally,
  // but RHF's type system cannot reconcile the transform gap, so we assert.
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createFinancialDataSchema) as any,
    mode: 'onBlur',
    defaultValues: {
      stock_id: stockId,
      fiscal_year: currentYear,
      fiscal_quarter: 'FY',
      consolidation_type: 'consolidated',
      revenue: '',
      operating_income: '',
      net_income: '',
      total_assets: '',
      equity: '',
      interest_bearing_debt: '',
      operating_cf: '',
      investing_cf: '',
      shares_outstanding: '',
      interest_expense: '',
      current_stock_price: '',
      input_unit: 'million',
    },
  });

  const selectedUnit = form.watch('input_unit');

  const onSubmit = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Send raw form values (strings) to the Server Action,
      // which handles its own validation and string→number transform.
      // zodResolver's transformed output (numbers) would fail the server schema.
      const result = await createFinancialData(
        form.getValues() as unknown as Parameters<typeof createFinancialData>[0]
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('財務データを保存しました');
      form.reset();
      onSuccess?.();
    } catch {
      toast.error('財務データの保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [form, isLoading, onSuccess]);

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        form.handleSubmit(onSubmit)();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [form, onSubmit]);

  const unitLabel = (fieldName: string) => {
    if (NO_CONVERSION_FIELDS.has(fieldName)) {
      return fieldName === 'shares_outstanding' ? '株' : '円';
    }
    return INPUT_UNIT_LABELS[selectedUnit as keyof typeof INPUT_UNIT_LABELS] ?? '百万円';
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Period attributes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="fiscal_year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  年度 <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fiscal_quarter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  四半期 <span className="text-destructive">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FISCAL_QUARTER_OPTIONS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {FISCAL_QUARTER_LABELS[q]}
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
            name="consolidation_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  連結/単体 <span className="text-destructive">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONSOLIDATION_TYPE_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONSOLIDATION_TYPE_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Unit selection */}
        <FormField
          control={form.control}
          name="input_unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>金額の入力単位</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INPUT_UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {INPUT_UNIT_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                株式数と現在株価は単位変換の対象外です
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Required fields */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">
            必須項目
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {AMOUNT_FIELDS.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {f.label} <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="例: 1,234,567"
                          inputMode="decimal"
                          {...field}
                        />
                      </FormControl>
                      <span className="text-muted-foreground shrink-0 text-sm">
                        {unitLabel(f.name)}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </fieldset>

        {/* Optional fields */}
        <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" type="button" className="gap-2">
              <ChevronsUpDown className="h-4 w-4" />
              オプション項目（{optionalOpen ? '閉じる' : '展開する'}）
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {OPTIONAL_FIELDS.map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{f.label}</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            placeholder={
                              NO_CONVERSION_FIELDS.has(f.name)
                                ? '例: 1000000'
                                : '例: 1,234,567'
                            }
                            inputMode="decimal"
                            {...field}
                          />
                        </FormControl>
                        <span className="text-muted-foreground shrink-0 text-sm">
                          {unitLabel(f.name)}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? '保存中...' : '財務データを保存する'}
          </Button>
          <p className="text-muted-foreground self-center text-xs">
            Ctrl+S でも保存できます
          </p>
        </div>
      </form>
    </Form>
  );
}
