import React from "react";
import { useFinancialPlanningOverview } from "@/hooks/use-plans";

export function PlanningHeader({ clientId }: { clientId: number }) {
  const { data, isLoading } = useFinancialPlanningOverview(clientId);

  if (isLoading || !data) return null;

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center">

      {/* 👤 CLIENT */}
      <div>
        <p className="text-xs text-slate-500">Client</p>
        <p className="text-lg font-semibold text-slate-900">
          Financial Overview
        </p>
      </div>

      {/* 📊 KEY METRICS */}
      <div className="flex items-center gap-8 text-sm">

        <div>
          <p className="text-slate-500">Net Worth</p>
          <p className={`font-semibold ${data.netWorth >= 0 ? "text-green-600" : "text-red-600"}`}>
            ${Number(data.netWorth).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Assets</p>
          <p className="text-slate-900 font-medium">
            ${Number(data.totalAssets).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Liabilities</p>
          <p className="text-red-600 font-medium">
            ${Number(data.totalLiabilities).toLocaleString()}
          </p>
        </div>

        {data.insuranceAnalyses === 0 && (
          <div className="text-amber-600 font-medium">
            ⚠ No Insurance Plan
          </div>
        )}
      </div>
    </div>
  );
}