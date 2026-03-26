'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
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
import { getOrCreateParameters, updateParameters } from '@/actions/parameters';

/** Convert internal value to display value (e.g. 0.08 → 8.0) */
function toDisplay(key: ParameterKey, value: number): number {
  const meta = PARAMETER_META[key];
  return Math.round(value * meta.displayMultiplier * 1000) / 1000;
}

/** Convert display value back to internal value (e.g. 8.0 → 0.08) */
function fromDisplay(key: ParameterKey, displayValue: number): number {
  const meta = PARAMETER_META[key];
  return displayValue / meta.displayMultiplier;
}

/** Slider min/max/step in display units */
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
  initialParameters: ParametersRow | null;
  onParametersChange?: (params: ParametersRow) => void;
}) {
  const [parameters, setParameters] = useState<ParametersRow | null>(initialParameters);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSaved = useCallback((newParams: ParametersRow) => {
    setParameters(newParams);
    onParametersChange?.(newParams);
  }, [onParametersChange]);

  // Initialize parameters on first mount if not yet created
  useEffect(() => {
    if (parameters) return;
    setIsInitializing(true);
    getOrCreateParameters(stockId)
      .then((result) => {
        if (result.success && result.data) {
          setParameters(result.data);
          onParametersChange?.(result.data);
        } else {
          toast.error(result.error ?? 'パラメータの取得に失敗しました');
        }
      })
      .catch(() => {
        toast.error('パラメータの取得中にエラーが発生しました');
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [stockId]); // eslint-disable-line react-hooks/exhaustive-deps -- parameters and onParametersChange intentionally excluded; effect only runs on mount

  if (isInitializing || !parameters) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">パラメータを読み込んでいます...</p>
      </div>
    );
  }

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
        const result = await updateParameters(stockId, values);
        if (result.success && result.data) {
          toast.success('パラメータを保存しました');
          onSaved(result.data);
        } else {
          toast.error(result.error ?? 'パラメータの保存に失敗しました');
        }
      });
    },
    [stockId, onSaved, startTransition]
  );

  const handleReset = useCallback(() => {
    form.setValue('discount_rate', PARAMETER_DEFAULTS.discount_rate, { shouldDirty: true });
    form.setValue('growth_rate', PARAMETER_DEFAULTS.growth_rate, { shouldDirty: true });
    form.setValue('tax_rate', PARAMETER_DEFAULTS.tax_rate, { shouldDirty: true });
    form.setValue('cap_multiplier', PARAMETER_DEFAULTS.cap_multiplier, { shouldDirty: true });
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
          <Button
            type="submit"
            disabled={isPending || !form.formState.isDirty}
          >
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
                  onValueChange={([v]) => {
                    field.onChange(fromDisplay(paramKey, v));
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
                <span className="w-6 text-sm text-muted-foreground">{meta.unit}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              デフォルト: {toDisplay(paramKey, PARAMETER_DEFAULTS[paramKey])}{meta.unit}
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
