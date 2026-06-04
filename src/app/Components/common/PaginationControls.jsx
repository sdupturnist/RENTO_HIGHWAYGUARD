"use client";
import { Button } from "@/app/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];
export function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }) {
    const safePageSize = PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : PAGE_SIZE_OPTIONS[0];
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const current = Math.min(page, totalPages);
    const makePageNumbers = () => {
        const nums = [];
        const maxButtons = 5;
        let start = Math.max(1, current - 2);
        let end = Math.min(totalPages, start + maxButtons - 1);
        if (end - start < maxButtons - 1)
            start = Math.max(1, end - maxButtons + 1);
        for (let i = start; i <= end; i++)
            nums.push(i);
        return nums;
    };
    return (<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select value={pageSize.toString()} onValueChange={(val) => {
            const size = parseInt(val);
            onPageSizeChange(size);
            onPageChange(1);
        }}>
          <SelectTrigger className="w-[90px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt.toString()}>{opt}</SelectItem>))}
          </SelectContent>
        </Select>
        <span className="ml-4">
          Page {current} of {totalPages} ({total} total)
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, current - 1))} disabled={current === 1}>
          Previous
        </Button>
        {makePageNumbers().map((n) => (<Button key={n} variant={n === current ? "default" : "outline"} size="sm" onClick={() => onPageChange(n)}>
            {n}
          </Button>))}
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, current + 1))} disabled={current === totalPages}>
          Next
        </Button>
      </div>
    </div>);
}
