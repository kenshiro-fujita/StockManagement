/**
 * 理論株価計算に用いる前提値の入力・保存を担当します。
 *
 * 表示単位と内部単位の変換をこの境界に閉じ込め、計算ロジックへは常に
 * 正規化済みの値だけを渡します。
 */
'use client';

import { useCallback, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  updateParametersSchema,
  PARAMETER_DEFAULTS,
  PARAMETER_META,
  PARAMETER_KEYS,
  type ParameterKey,
  type UpdateParametersInput,
} from '@/lib/schemas/parameters';
import type { ParametersRow } from '@/lib/types/parameters';
import { updateParameters } from '@/actions/parameters';

/** 内部値を利用者向けの表示単位へ変換します（例: 0.08 → 8.0）。 */
function toDisplay(key: ParameterKey, value: number): number {
  const meta = PARAMETER_META[key];
  return Math.round(value * meta.displayMultiplier * 1000) / 1000;
}

/** 表示単位の値を計算用の内部値へ戻します（例: 8.0 → 0.08）。 */
function fromDisplay(key: ParameterKey, displayValue: number): number {
  const meta = PARAMETER_META[key];
  return displayValue / meta.displayMultiplier;
}

/** スライダーの範囲と刻みを表示単位で返します。 */
function sliderProps(key: ParameterKey) {
  const meta = PARAMETER_META[key];
  return {
    min: meta.min * meta.displayMultiplier,
    max: meta.max * meta.displayMultiplier,
    step: meta.step * meta.displayMultiplier,
  };
}

export function ParameterSection({
  stockId,
  initialParameters,
  onParametersChange,
}: {
  stockId: string;
  initialParameters: ParametersRow;
  onParametersChange?: (params: ParametersRow) => void;
}) {
  const [parameters, setParameters] =
    useState<ParametersRow>(initialParameters);
  const [isPending, startTransition] = useTransition();

  const handleSaved = useCallback(
    (newParams: ParametersRow) => {
      setParameters(newParams);
      onParametersChange?.(newParams);
    },
    [onParametersChange]
  );

  return (
    <ParameterForm
      stockId={stockId}
      parameters={parameters}
      onSaved={handleSaved}
      isPending={isPending}
      startTransition={startTransition}
    />
  );
}

function ParameterForm({
  stockId,
  parameters,
  onSaved,
  isPending,
  startTransition,
}: {
  stockId: string;
  parameters: ParametersRow;
  onSaved: (p: ParametersRow) => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const form = useForm<UpdateParametersInput>({
    resolver: zodResolver(updateParametersSchema),
    mode: 'onBlur',
    defaultValues: {
      stock_id: stockId,
      discount_rate: parameters.discount_rate,
      growth_rate: parameters.growth_rate,
      tax_rate: parameters.tax_rate,
      cap_multiplier: parameters.cap_multiplier,
    },
  });

  const handleSubmit = useCallback(
    (values: UpdateParametersInput) => {
      startTransition(async () => {
        try {
          const result = await updateParameters(stockId, values);
          if (result.success) {
            toast.success('パラメータを保存しました');
            onSaved(result.data);
          } else {
            toast.error(result.error);
          }
        } catch {
          toast.error('パラメータの保存中にエラーが発生しました');
        }
      });
    },
    [stockId, onSaved, startTransition]
  );

  const handleReset = useCallback(() => {
    form.setValue('discount_rate', PARAMETER_DEFAULTS.discount_rate, {
      shouldDirty: true,
    });
    form.setValue('growth_rate', PARAMETER_DEFAULTS.growth_rate, {
      shouldDirty: true,
    });
    form.setValue('tax_rate', PARAMETER_DEFAULTS.tax_rate, {
      shouldDirty: true,
    });
    form.setValue('cap_multiplier', PARAMETER_DEFAULTS.cap_multiplier, {
      shouldDirty: true,
    });
  }, [form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <h3 className="text-lg font-semibold">パラメータ設定</h3>

        {PARAMETER_KEYS.map((key) => (
          <ParameterField key={key} paramKey={key} form={form} />
        ))}

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            デフォルトに戻す
          </Button>
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ParameterField({
  paramKey,
  form,
}: {
  paramKey: ParameterKey;
  form: ReturnType<typeof useForm<UpdateParametersInput>>;
}) {
  const meta = PARAMETER_META[paramKey];
  const slider = sliderProps(paramKey);

  return (
    <FormField
      control={form.control}
      name={paramKey}
      render={({ field }) => {
        const displayValue = toDisplay(paramKey, field.value);

        return (
          <FormItem>
            <FormLabel>{meta.label}</FormLabel>
            <div className="flex items-center gap-4">
              <FormControl>
                <Slider
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={[displayValue]}
                  onValueChange={(values) => {
                    const value = values[0];
                    if (value != null) {
                      field.onChange(fromDisplay(paramKey, value));
                    }
                  }}
                  aria-label={meta.label}
                  className="flex-1"
                />
              </FormControl>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={displayValue}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) {
                      field.onChange(fromDisplay(paramKey, v));
                    }
                  }}
                  onBlur={field.onBlur}
                  className="w-20 text-right tabular-nums"
                  aria-label={`${meta.label}の値`}
                />
                <span className="w-6 text-sm text-muted-foreground">
                  {meta.unit}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              デフォルト: {toDisplay(paramKey, PARAMETER_DEFAULTS[paramKey])}
              {meta.unit}
              {' — '}
              {meta.description}
            </p>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
