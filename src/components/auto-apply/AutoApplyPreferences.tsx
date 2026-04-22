import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, MapPin, DollarSign, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

interface AutoApplyPrefs {
  jobTitles: string[];
  salaryMin: string;
  salaryMax: string;
  locations: string[];
  remoteOnly: boolean;
  requireReview: boolean;
  minMatchScore: number;
  applyMode: "manual" | "smart" | "full-auto";
  riskTolerance: number;
}

interface AutoApplyPreferencesProps {
  prefs: AutoApplyPrefs;
  setPrefs: React.Dispatch<React.SetStateAction<AutoApplyPrefs>>;
  profileLoaded: boolean;
  titleInput: string;
  setTitleInput: (v: string) => void;
  locationInput: string;
  setLocationInput: (v: string) => void;
  isSearching: boolean;
  queueLength: number;
  onSearch: () => void;
  onClearQueue: () => void;
}

export function AutoApplyPreferences({
  prefs,
  setPrefs,
  profileLoaded,
  titleInput,
  setTitleInput,
  locationInput,
  setLocationInput,
  isSearching,
  queueLength,
  onSearch,
  onClearQueue,
}: AutoApplyPreferencesProps) {
  const addTitle = () => {
    const t = titleInput.trim();
    if (!t) return;
    if (prefs.jobTitles.includes(t)) {
      toast.error("Already added");
      return;
    }
    setPrefs({ ...prefs, jobTitles: [...prefs.jobTitles, t] });
    setTitleInput("");
  };

  const addLocation = () => {
    const l = locationInput.trim();
    if (!l) return;
    setPrefs({ ...prefs, locations: [...prefs.locations, l] });
    setLocationInput("");
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-primary text-lg">
            Job Preferences
          </h2>
        </div>
        {profileLoaded && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Loaded from profile
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {/* Job Titles */}
        <div>
          <Label className="text-sm font-semibold">Target Job Titles</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g. Security Engineer"
              onKeyDown={(e) => e.key === "Enter" && addTitle()}
            />
            <Button variant="outline" size="sm" onClick={addTitle}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {prefs.jobTitles.map((t, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="cursor-pointer"
                onClick={() =>
                  setPrefs({
                    ...prefs,
                    jobTitles: prefs.jobTitles.filter((_, idx) => idx !== i),
                  })
                }
              >
                {t} <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>

        {/* Salary Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-semibold">Min Salary</Label>
            <div className="flex items-center gap-1 mt-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                value={prefs.salaryMin}
                onChange={(e) =>
                  setPrefs({ ...prefs, salaryMin: e.target.value })
                }
                placeholder="80,000"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold">Max Salary</Label>
            <div className="flex items-center gap-1 mt-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                value={prefs.salaryMax}
                onChange={(e) =>
                  setPrefs({ ...prefs, salaryMax: e.target.value })
                }
                placeholder="150,000"
              />
            </div>
          </div>
        </div>

        {/* Locations */}
        <div>
          <Label className="text-sm font-semibold">Preferred Locations</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="e.g. Washington DC"
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
            />
            <Button variant="outline" size="sm" onClick={addLocation}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {prefs.locations.map((l, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="cursor-pointer"
                onClick={() =>
                  setPrefs({
                    ...prefs,
                    locations: prefs.locations.filter((_, idx) => idx !== i),
                  })
                }
              >
                <MapPin className="w-3 h-3 mr-1" />
                {l} <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={prefs.remoteOnly}
              onCheckedChange={(v) => setPrefs({ ...prefs, remoteOnly: v })}
            />
            <Label className="text-sm">Remote Only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={prefs.requireReview}
              onCheckedChange={(v) => setPrefs({ ...prefs, requireReview: v })}
            />
            <Label className="text-sm">Require Review</Label>
          </div>
        </div>

        {/* Min Score */}
        <div>
          <Label className="text-sm font-semibold">
            Minimum Match Score: {prefs.minMatchScore}%
          </Label>
          <input
            type="range"
            min={30}
            max={90}
            value={prefs.minMatchScore}
            onChange={(e) =>
              setPrefs({ ...prefs, minMatchScore: parseInt(e.target.value) })
            }
            className="w-full mt-1 accent-[hsl(var(--accent))]"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>More Jobs (30%)</span>
            <span>Higher Quality (90%)</span>
          </div>
        </div>

        {/* Risk Tolerance */}
        <div>
          <Label className="text-sm font-semibold">
            Risk Tolerance: {prefs.riskTolerance}%
          </Label>
          <input
            type="range"
            min={10}
            max={90}
            value={prefs.riskTolerance}
            onChange={(e) =>
              setPrefs({ ...prefs, riskTolerance: parseInt(e.target.value) })
            }
            className="w-full mt-1 accent-[hsl(var(--accent))]"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Conservative (safe bets only)</span>
            <span>Aggressive (stretch roles)</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90"
          disabled={isSearching}
          onClick={onSearch}
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" /> Find & Queue Jobs
            </>
          )}
        </Button>
        {queueLength > 0 && (
          <Button variant="outline" size="sm" onClick={onClearQueue}>
            Clear Queue
          </Button>
        )}
      </div>
    </Card>
  );
}
