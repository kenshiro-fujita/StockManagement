'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type FieldErrors, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertTriangle, ChevronsUpDown } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { fromYen, INPUT_UNIT_LABELS, type InputUnit } from '@/lib/utils/unit-conversion';
import { createFinancialData, updateFinancialData } from '@/actions/financial-data';
import type { FullFinancialDataRow } from '@/lib/types/financial-data';

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

// All amount field names for reverse conversion
const ALL_CONVERT_FIELDS = new Set([
  'revenue',
  'operating_income',
  'net_income',
  'total_assets',
  'equity',
  'interest_bearing_debt',
  'operating_cf',
  'investing_cf',
  'interest_expense',
]);

export type ExistingPeriod = {
  fiscal_year: number;
  fiscal_quarter: string;
  consolidation_type: string;
};

function buildDefaultValues(
  stockId: string,
  editData: FullFinancialDataRow | null | undefined,
): FormValues {
  if (!editData) {
    const currentYear = new Date().getFullYear();
    return {
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
    };
  }

  const unit = editData.input_unit as InputUnit;

  // Reverse-convert yen values to the original input unit.
  // Use toFixed to avoid scientific notation (e.g. 1e-7) for very small results.
  const toPlainString = (n: number): string => {
    if (Number.isInteger(n)) return String(n);
    // toFixed(10) handles up to 10 decimal places, then strip trailing zeros
    return n.toFixed(10).replace(/\.?0+$/, '');
  };

  const reverseConvert = (fieldName: string, value: number | null): string => {
    if (value == null) return '';
    if (NO_CONVERSION_FIELDS.has(fieldName)) return toPlainString(value);
    if (ALL_CONVERT_FIELDS.has(fieldName)) return toPlainString(fromYen(value, unit));
    return toPlainString(value);
  };

  return {
    stock_id: stockId,
    fiscal_year: editData.fiscal_year,
    fiscal_quarter: editData.fiscal_quarter as FormValues['fiscal_quarter'],
    consolidation_type: editData.consolidation_type as FormValues['consolidation_type'],
    revenue: reverseConvert('revenue', editData.revenue),
    operating_income: reverseConvert('operating_income', editData.operating_income),
    net_income: reverseConvert('net_income', editData.net_income),
    total_assets: reverseConvert('total_assets', editData.total_assets),
    equity: reverseConvert('equity', editData.equity),
    interest_bearing_debt: reverseConvert('interest_bearing_debt', editData.interest_bearing_debt),
    operating_cf: reverseConvert('operating_cf', editData.operating_cf),
    investing_cf: reverseConvert('investing_cf', editData.investing_cf),
    shares_outstanding: reverseConvert('shares_outstanding', editData.shares_outstanding),
    interest_expense: reverseConvert('interest_expense', editData.interest_expense),
    current_stock_price: reverseConvert('current_stock_price', editData.current_stock_price),
    input_unit: editData.input_unit as FormValues['input_unit'],
  };
}

export function FinancialDataForm({
  stockId,
  editData,
  existingPeriods = [],
  onSuccess,
  onCancel,
  onDirtyChange,
}: {
  stockId: string;
  editData?: FullFinancialDataRow | null;
  existingPeriods?: ExistingPeriod[];
  onSuccess?: () => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const isEditMode = !!editData;
  const [isLoading, setIsLoading] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(
    // Auto-expand optional fields in edit mode if any optional field has a value
    isEditMode && OPTIONAL_FIELDS.some((f) => editData[f.name as keyof FullFinancialDataRow] != null)
  );
  const optionalOpenRef = useRef(optionalOpen);
  useEffect(() => {
    optionalOpenRef.current = optionalOpen;
  }, [optionalOpen]);

  // zodResolver bridges z.input (strings) → z.output (numbers) internally,
  // but RHF's type system cannot reconcile the transform gap, so we assert.
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createFinancialDataSchema) as any,
    mode: 'onBlur',
    shouldFocusError: true,
    defaultValues: buildDefaultValues(stockId, editData),
  });

  const { isDirty } = form.formState;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const selectedUnit = form.watch('input_unit');
  const watchedYear = form.watch('fiscal_year');
  const watchedQuarter = form.watch('fiscal_quarter');
  const watchedType = form.watch('consolidation_type');

  // In edit mode, skip duplicate detection (the record itself would match)
  const isDuplicate = useMemo(
    () =>
      !isEditMode &&
      existingPeriods.some(
        (p) =>
          p.fiscal_year === watchedYear &&
          p.fiscal_quarter === watchedQuarter &&
          p.consolidation_type === watchedType
      ),
    [isEditMode, existingPeriods, watchedYear, watchedQuarter, watchedType]
  );

  // Open Collapsible automatically when optional fields have validation errors,
  // then focus the first error field after the DOM updates.
  const onInvalid = useCallback(
    (errors: FieldErrors<FormValues>) => {
      const optionalFieldNames: Set<string> = new Set(
        OPTIONAL_FIELDS.map((f) => f.name)
      );
      const hasOptionalError = Object.keys(errors).some((key) =>
        optionalFieldNames.has(key)
      );
      if (hasOptionalError && !optionalOpenRef.current) {
        setOptionalOpen(true);
        // Focus the first error field after Collapsible renders
        requestAnimationFrame(() => {
          const firstErrorKey = Object.keys(errors)[0];
          if (firstErrorKey) {
            const el = document.querySelector<HTMLInputElement>(
              `[name="${firstErrorKey}"]`
            );
            el?.focus();
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    },
    [] // stable reference — uses optionalOpenRef instead of optionalOpen
  );

  const onSubmit = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Send raw form values (strings) to the Server Action,
      // which handles its own validation and string→number transform.
      // zodResolver's transformed output (numbers) would fail the server schema.
      const rawValues = form.getValues() as unknown as Parameters<typeof createFinancialData>[0];

      const result = isEditMode
        ? await updateFinancialData(editData.id, rawValues)
        : await createFinancialData(rawValues);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditMode ? '財務データを更新しました' : '財務データを保存しました');
      if (!isEditMode) form.reset();
      onSuccess?.();
    } catch {
      toast.error(isEditMode ? '財務データの更新に失敗しました' : '財務データの保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [form, isLoading, isEditMode, editData, onSuccess]);

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        form.handleSubmit(onSubmit, onInvalid)();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [form, onSubmit, onInvalid]);

  const handleCancel = useCallback(() => {
    if (form.formState.isDirty) {
      if (!window.confirm('未保存の変更があります。破棄しますか？')) {
        return;
      }
    }
    onCancel?.();
  }, [form.formState.isDirty, onCancel]);

  const unitLabel = (fieldName: string) => {
    if (NO_CONVERSION_FIELDS.has(fieldName)) {
      return fieldName === 'shares_outstanding' ? '株' : '円';
    }
    return INPUT_UNIT_LABELS[selectedUnit as keyof typeof INPUT_UNIT_LABELS] ?? '百万円';
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        {isDuplicate && (
          <Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription>
              この期間のデータは既に登録されています。既存データを編集する場合は一覧から選択してください。
            </AlertDescription>
          </Alert>
        )}

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
                    disabled={isEditMode}
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
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}>
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
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}>
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
            {isLoading
              ? (isEditMode ? '更新中...' : '保存中...')
              : (isEditMode ? '財務データを更新する' : '財務データを保存する')
            }
          </Button>
          {isEditMode && (
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              キャンセル
            </Button>
          )}
          <p className="text-muted-foreground self-center text-xs">
            Ctrl+S でも保存できます
          </p>
        </div>
      </form>
    </Form>
  );
}
