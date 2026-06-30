/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse" id="card-skeleton">
      {/* Left Section: Checkbox / Bullet & Info */}
      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
        {/* Mock Checkbox/Indicator */}
        <div className="pt-1 flex-shrink-0">
          <div className="h-4 w-4 bg-slate-200 rounded" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {/* Header Info: Name & Status Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-5 w-48 bg-slate-200 rounded-md" />
            <div className="h-4 w-16 bg-slate-200 rounded-full" />
          </div>

          {/* Meta Info Row: Phone, Dependence, Bairro */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="h-4 w-32 bg-slate-200 rounded-md" />
            <div className="h-4 w-40 bg-slate-200 rounded-md" />
            <div className="h-4 w-24 bg-slate-200 rounded-md" />
          </div>

          {/* Sub Row */}
          <div className="flex gap-1.5 items-center">
            <div className="h-4.5 w-28 bg-slate-200 rounded-md" />
            <div className="h-4.5 w-20 bg-slate-200 rounded-md" />
          </div>
        </div>
      </div>

      {/* Right Section: Pencil Action Button */}
      <div className="flex items-center justify-end flex-shrink-0">
        <div className="h-8 w-8 bg-slate-200 rounded-full" />
      </div>
    </div>
  );
};

export default CardSkeleton;
