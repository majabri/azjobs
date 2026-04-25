import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function RoleSelect({
  userId,
  currentRole,
  disabled,
  onChangeRole,
}: {
  userId: string;
  currentRole: string;
  disabled: boolean;
  onChangeRole: (userId: string, role: string) => void;
}) {
  return (
    <Select
      value={currentRole}
      onValueChange={(v) => onChangeRole(userId, v)}
      disabled={disabled}
    >
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="job_seeker">Job Seeker</SelectItem>
        <SelectItem value="recruiter">Recruiter</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function MiniStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-card rounded-lg p-3 border border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
        {icon} {label}
      </div>
      <div
        className={`font-display font-bold text-xl ${color ?? "text-foreground"}`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
