"use client";

import { formatBps, formatDuration, type Bounds, type GovConfig } from "@moneta/sdk";
import { Field, Input } from "@/components/ui/forms";
import type { CfgInput } from "@/lib/gov-config";

export { fromCfgInput, thresholdCopy, toCfgInput, type CfgInput } from "@/lib/gov-config";

export function ConfigEditor({
  cfg,
  setCfg,
  errors,
  bounds: b,
}: {
  cfg: CfgInput;
  setCfg: (c: CfgInput) => void;
  errors: Record<string, string>;
  bounds: Bounds;
}) {
  const fields: { k: keyof GovConfig; label: string; suffix: string; hint: string }[] = [
    {
      k: "warmup",
      label: "Warm-up",
      suffix: "sec",
      hint: `Markets open before the TWAP starts counting · ${formatDuration(b.minWarmup)} to ${formatDuration(b.maxWarmup)}`,
    },
    {
      k: "duration",
      label: "Trading window",
      suffix: "sec",
      hint: `TWAP window · ${formatDuration(b.minDuration)} to ${formatDuration(b.maxDuration)}`,
    },
    {
      k: "thetaTrancheBps",
      label: "Threshold, tranche releases",
      suffix: "bps",
      hint: "How far PASS must beat FAIL (100 bps = 1%)",
    },
    {
      k: "thetaTeamBps",
      label: "Threshold, founder proposals",
      suffix: "bps",
      hint: `${b.minTheta} to ${b.maxTheta} bps`,
    },
    {
      k: "thetaCommunityBps",
      label: "Threshold, community proposals",
      suffix: "bps",
      hint: "Includes redemption",
    },
    {
      k: "proposalLiquidityBps",
      label: "Liquidity migrated",
      suffix: "bps",
      hint: `Share of spot liquidity moved into each market pair · ${formatBps(b.minProposalLiquidityBps, { digits: 0 })} to ${formatBps(b.maxProposalLiquidityBps, { digits: 0 })}`,
    },
    {
      k: "maxStepBps",
      label: "Oracle step cap",
      suffix: "bps/s",
      hint: "Max movement of the lagging observation per second",
    },
    {
      k: "executionGrace",
      label: "Execution grace",
      suffix: "sec",
      hint: "Retry window if a passed action reverts",
    },
    { k: "bond", label: "Proposal bond", suffix: "USDC", hint: "Refunded on PASS, kept on FAIL" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <Field key={f.k} label={f.label} htmlFor={`cfg-${f.k}`} error={errors[f.k]} hint={f.hint}>
          <Input
            id={`cfg-${f.k}`}
            inputMode={f.k.startsWith("theta") ? "text" : "decimal"}
            autoComplete="off"
            value={cfg[f.k]}
            onChange={(e) => setCfg({ ...cfg, [f.k]: e.target.value })}
            suffix={f.suffix}
            invalid={!!errors[f.k]}
          />
        </Field>
      ))}
    </div>
  );
}
