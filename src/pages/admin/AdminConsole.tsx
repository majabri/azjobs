import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Terminal, ChevronRight, Clock, CheckCircle2, XCircle,
  History, HelpCircle, Trash2,
} from "lucide-react";
import { executeAdminCommand, ALLOWED_COMMANDS, parseCommandString } from "@/lib/api/adminCommand";
import type { AdminCommandResponse } from "@/lib/api/adminCommand";

interface HistoryEntry {
  id: string;
  input: string;
  response: AdminCommandResponse | null;
  timestamp: Date;
  loading: boolean;
}

const WELCOME_TEXT = `
╔══════════════════════════════════════════════════╗
║        FitCheck Admin Command Console v1.0       ║
║  Type "help" for available commands              ║
╚══════════════════════════════════════════════════╝

IMPORTANT: Only registered commands are allowed.
No shell or OS access. All commands are logged.
`.trim();

export default function AdminConsole() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { scrollBottom(); }, [history, scrollBottom]);

  const handleInput = (val: string) => {
    setInput(val);
    setHistoryIdx(-1);

    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    const lower = val.toLowerCase();
    const matches = ALLOWED_COMMANDS
      .map((c) => c.name)
      .filter((name) => name.startsWith(lower));
    setSuggestions(matches.slice(0, 5));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(newIdx);
      setInput(cmdHistory[newIdx] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(newIdx);
      setInput(newIdx === -1 ? "" : cmdHistory[newIdx]);
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      setInput(suggestions[0]);
      setSuggestions([]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  };

  const submit = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setSuggestions([]);
    setInput("");
    setCmdHistory((prev) => [trimmed, ...prev].slice(0, 50));
    setHistoryIdx(-1);

    // Local built-in commands
    if (trimmed === "clear") {
      setHistory([]);
      return;
    }

    if (trimmed === "help") {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        input: trimmed,
        response: {
          command: "help",
          args: {},
          result: {
            commands: ALLOWED_COMMANDS.map((c) => ({
              name: c.name,
              description: c.description,
              example: c.example,
            })),
          },
          success: true,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        loading: false,
      };
      setHistory((prev) => [...prev, entry]);
      return;
    }

    const parsed = parseCommandString(trimmed);
    if (!parsed) {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        input: trimmed,
        response: {
          command: trimmed,
          args: {},
          result: { error: "Invalid command format" },
          success: false,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        loading: false,
      };
      setHistory((prev) => [...prev, entry]);
      return;
    }

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      input: trimmed,
      response: null,
      timestamp: new Date(),
      loading: true,
    };
    setHistory((prev) => [...prev, entry]);

    const response = await executeAdminCommand(parsed.command, parsed.args);

    setHistory((prev) =>
      prev.map((h) => (h.id === entry.id ? { ...h, response, loading: false } : h))
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Terminal className="w-6 h-6 text-accent" /> Admin Console
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Secure command execution — strict registry only, all actions logged
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHelp((v) => !v)}>
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> {showHelp ? "Hide" : "Help"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHistory([])}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear
          </Button>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Available Commands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ALLOWED_COMMANDS.map((cmd) => (
              <div key={cmd.name} className="flex items-start gap-3 text-xs">
                <code className="bg-muted rounded px-1.5 py-0.5 text-accent font-mono shrink-0">
                  {cmd.name}
                </code>
                <div>
                  <p className="text-foreground">{cmd.description}</p>
                  <p className="text-muted-foreground font-mono mt-0.5">Example: {cmd.example}</p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-3 text-xs">
              <code className="bg-muted rounded px-1.5 py-0.5 text-accent font-mono shrink-0">clear</code>
              <p className="text-foreground">Clear terminal output</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terminal */}
      <Card className="border-border bg-[#0d1117] text-green-400 font-mono">
        <CardContent className="p-4">
          {/* Output area */}
          <div
            className="min-h-[400px] max-h-[500px] overflow-y-auto text-xs space-y-3 mb-4"
            onClick={() => inputRef.current?.focus()}
          >
            {/* Welcome */}
            <pre className="text-green-600 text-[10px] leading-relaxed">{WELCOME_TEXT}</pre>

            {/* History */}
            {history.map((entry) => (
              <div key={entry.id} className="space-y-1">
                {/* Input line */}
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-[10px]">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="text-green-400">$</span>
                  <span className="text-white">{entry.input}</span>
                </div>

                {/* Output */}
                {entry.loading ? (
                  <div className="flex items-center gap-2 text-[10px] text-yellow-400 pl-4">
                    <Clock className="w-3 h-3 animate-spin" /> Executing…
                  </div>
                ) : entry.response && (
                  <OutputBlock response={entry.response} />
                )}
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Input line */}
          <div className="relative border-t border-green-900 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-sm">$</span>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command… (Tab to autocomplete, ↑↓ history)"
                className="bg-transparent border-0 text-white placeholder:text-green-900 text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Autocomplete suggestions */}
            {suggestions.length > 0 && (
              <div className="absolute bottom-full mb-1 left-6 bg-[#161b22] border border-green-900 rounded shadow-lg z-10 min-w-48">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="block w-full text-left px-3 py-1.5 text-xs text-green-400 hover:bg-green-900/30 font-mono"
                    onMouseDown={(e) => { e.preventDefault(); setInput(s + " "); setSuggestions([]); inputRef.current?.focus(); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Command history sidebar */}
      {cmdHistory.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> Command History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {cmdHistory.slice(0, 10).map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(cmd); inputRef.current?.focus(); }}
                  className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OutputBlock({ response }: { response: AdminCommandResponse }) {
  const { success, result, command } = response;

  if (command === "help" && result.commands) {
    return (
      <div className="pl-4 space-y-1 text-[10px]">
        {(result.commands as any[]).map((cmd) => (
          <div key={cmd.name} className="flex gap-3">
            <span className="text-cyan-400 w-24 shrink-0">{cmd.name}</span>
            <span className="text-green-600">{cmd.description}</span>
          </div>
        ))}
        <div className="flex gap-3">
          <span className="text-cyan-400 w-24 shrink-0">clear</span>
          <span className="text-green-600">Clear terminal output</span>
        </div>
        <div className="flex gap-3">
          <span className="text-cyan-400 w-24 shrink-0">help</span>
          <span className="text-green-600">Show this help</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-4">
      <div className={`flex items-center gap-1.5 text-[10px] mb-1 ${success ? "text-green-500" : "text-red-400"}`}>
        {success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        <span>{success ? "Success" : "Error"}</span>
      </div>
      <pre className={`text-[10px] leading-relaxed whitespace-pre-wrap break-all ${success ? "text-green-300" : "text-red-300"}`}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
