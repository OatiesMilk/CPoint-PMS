"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The end of a report (Phase 35, A-69): a Remarks box whose text prints with the report (empty, it
 * prints three ruled lines to write on), then Prepared by and Checked by signature lines. Nothing
 * is saved: the printed paper is the record.
 */
export function ReportFooter() {
  const [remarks, setRemarks] = useState("");
  return (
    <section aria-label="Remarks and signatures" className="flex break-inside-avoid flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-remarks">Remarks</Label>
        <Textarea
          id="report-remarks"
          value={remarks}
          maxLength={1000}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Anything to note on the printed report. It prints with it and is not saved."
          className="print:hidden"
        />
        <div className="hidden print:block" data-testid="print-remarks">
          {remarks.trim() ? (
            <p className="whitespace-pre-wrap">{remarks}</p>
          ) : (
            <div aria-hidden>
              <div className="h-8 border-b" />
              <div className="h-8 border-b" />
              <div className="h-8 border-b" />
            </div>
          )}
        </div>
      </div>
      <div className="hidden grid-cols-2 gap-12 pt-6 print:grid" data-testid="print-signatures">
        {["Prepared by", "Checked by"].map((who) => (
          <div key={who} className="border-t pt-1 text-sm">
            {who}: signature over printed name, date
          </div>
        ))}
      </div>
    </section>
  );
}
