import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/Button";
import { formatDate } from "../copy";
import { eligibilityReminderIcs } from "./ics";
import { downloadBlob } from "./links";

/** Downloads an all-day calendar event on the eligible date, with an alarm the day before. */
export function ReminderButton({ donorId, eligibleFrom, className }: { donorId: string; eligibleFrom: number; className?: string }) {
  const save = () => {
    const ics = eligibilityReminderIcs({ donorId, eligibleFrom });
    downloadBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), "blood-bridge-eligible-again.ics");
    toast.success(`Reminder saved for ${formatDate(eligibleFrom)}. Open the file to add it to your calendar.`);
  };
  return (
    <Button variant="secondary" size="lg" className={className} icon={<CalendarPlus className="size-4" aria-hidden />} onClick={save}>
      Remind me on {formatDate(eligibleFrom)}
    </Button>
  );
}
