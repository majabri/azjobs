import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface SkillsTagInputProps {
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}

const SUGGESTED_SKILLS = [
  "React", "TypeScript", "Node.js", "Python", "AWS", "SQL", "Docker",
  "Kubernetes", "GraphQL", "REST API", "CI/CD", "Git", "Agile", "Figma",
  "Java", "Go", "Ruby", "PostgreSQL", "MongoDB", "Redis",
];

export default function SkillsTagInput({ value, onChange, placeholder = "Type a skill and press Enter..." }: SkillsTagInputProps) {
  const [input, setInput] = useState("");

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const removeSkill = (skill: string) => {
    onChange(value.filter((s) => s !== skill));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeSkill(value[value.length - 1]);
    }
  };

  const suggestions = SUGGESTED_SKILLS.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-background min-h-[42px]">
        {value.map((skill) => (
          <Badge key={skill} variant="secondary" className="gap-1 text-xs">
            {skill}
            <X className="w-3 h-3 cursor-pointer" onClick={() => removeSkill(skill)} />
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="border-0 shadow-none p-0 h-6 min-w-[120px] flex-1 focus-visible:ring-0"
        />
      </div>
      {input && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.slice(0, 6).map((s) => (
            <Badge
              key={s}
              variant="outline"
              className="cursor-pointer hover:bg-accent text-xs"
              onClick={() => addSkill(s)}
            >
              + {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
