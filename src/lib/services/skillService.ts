/**
 * Skill Service — Isolated module for skill extraction and matching.
 * No dependencies on other services. Only depends on shared types.
 */

// ─── Categorized Skill Keywords ───────────────────────────────────────────────
const SKILL_CATEGORIES: Record<string, string[]> = {
  "Programming Languages": [
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "golang", "rust",
    "ruby", "php", "swift", "kotlin", "scala", "r", "matlab", "perl", "bash", "shell",
    "powershell", "objective-c", "dart", "lua", "haskell", "elixir", "clojure",
  ],
  "Web & Frontend": [
    "react", "angular", "vue", "svelte", "next.js", "nuxt", "html", "css", "sass",
    "tailwind", "bootstrap", "jquery", "webpack", "vite", "redux", "graphql", "rest",
    "api", "responsive design", "web development", "frontend", "ui/ux",
  ],
  "Backend & Infrastructure": [
    "node", "node.js", "express", "django", "flask", "spring", "spring boot",
    ".net", "asp.net", "rails", "fastapi", "microservices", "serverless",
    "docker", "kubernetes", "terraform", "ansible", "jenkins", "ci/cd", "devops",
    "aws", "azure", "gcp", "cloud computing", "cloud architecture",
    "linux", "unix", "windows server", "vmware", "virtualization",
    "nginx", "apache", "load balancing", "cdn",
  ],
  "Data & Analytics": [
    "sql", "nosql", "mongodb", "postgresql", "mysql", "oracle", "redis",
    "elasticsearch", "kafka", "spark", "hadoop", "data analysis", "data engineering",
    "data science", "data modeling", "data warehousing", "etl", "data pipeline",
    "excel", "tableau", "power bi", "looker", "analytics", "business intelligence",
    "big data", "data visualization", "statistics", "reporting",
  ],
  "AI & Machine Learning": [
    "machine learning", "deep learning", "natural language processing", "nlp",
    "computer vision", "tensorflow", "pytorch", "scikit-learn", "neural networks",
    "ai", "artificial intelligence", "generative ai", "llm", "large language models",
    "reinforcement learning", "predictive modeling", "data mining",
  ],
  "Cybersecurity": [
    "cybersecurity", "information security", "infosec", "network security",
    "application security", "cloud security", "endpoint security",
    "vulnerability management", "penetration testing", "pen testing",
    "incident response", "threat intelligence", "threat detection",
    "siem", "soc", "security operations", "security architecture",
    "identity management", "iam", "access management", "zero trust",
    "encryption", "cryptography", "pki", "ssl/tls",
    "malware analysis", "forensics", "digital forensics",
    "dlp", "data loss prevention", "firewalls", "ids/ips",
    "security awareness", "security training",
    "devsecops", "secure sdlc", "application whitelisting",
  ],
  "Compliance & Governance": [
    "compliance", "governance", "risk management", "cyber risk",
    "grc", "audit", "internal audit", "regulatory compliance",
    "iso 27001", "iso/iec 27001", "iso 27002", "nist", "nist csf",
    "soc 2", "soc2", "sox", "hipaa", "pci dss", "pci", "gdpr", "ccpa", "fedramp",
    "cobit", "itil", "coso", "cmmc",
    "information assurance", "data privacy", "privacy",
    "policy development", "security policy", "risk assessment",
    "business continuity", "disaster recovery", "bcdr", "bcp", "drp",
    "third-party risk", "vendor risk management",
  ],
  "Project & Product Management": [
    "project management", "program management", "portfolio management",
    "product management", "product strategy", "product roadmap",
    "agile", "scrum", "kanban", "waterfall", "lean", "safe",
    "jira", "confluence", "asana", "trello",
    "pmp", "prince2", "six sigma",
    "stakeholder management", "requirements gathering", "business analysis",
    "change management", "release management",
  ],
  "Leadership & Strategy": [
    "leadership", "team leadership", "people management", "team building",
    "employee development", "mentoring", "coaching", "talent development",
    "strategic planning", "strategy", "digital transformation",
    "business process improvement", "process optimization",
    "organizational development", "cross-functional", "executive leadership",
    "budget management", "p&l", "cost optimization", "resource planning",
    "vendor management", "contract negotiation",
    "m&a", "mergers and acquisitions", "due diligence",
    "board reporting", "c-suite communication",
  ],
  "Communication & Soft Skills": [
    "communication", "public speaking", "presentation", "negotiation",
    "teamwork", "collaboration", "problem solving", "critical thinking",
    "analytical thinking", "decision making", "conflict resolution",
    "time management", "organizational skills", "attention to detail",
    "writing", "technical writing", "documentation",
    "customer success", "client relations", "relationship management",
  ],
  "Marketing & Sales": [
    "marketing", "digital marketing", "content marketing", "seo", "sem",
    "social media", "email marketing", "marketing automation",
    "google analytics", "hubspot", "salesforce", "crm",
    "sales", "business development", "lead generation",
    "brand strategy", "market research", "competitive analysis",
    "account management", "customer acquisition",
  ],
  "Design": [
    "ux", "ui", "user experience", "user interface", "ux design", "ui design",
    "figma", "sketch", "adobe xd", "invision",
    "graphic design", "visual design", "interaction design",
    "design thinking", "wireframing", "prototyping",
    "adobe creative suite", "photoshop", "illustrator",
  ],
  "Finance & Operations": [
    "finance", "accounting", "financial analysis", "financial modeling",
    "budgeting", "forecasting", "operations", "supply chain",
    "logistics", "procurement", "inventory management",
    "erp", "sap", "oracle financials",
    "lean manufacturing", "quality assurance", "qa",
  ],
  "Industry Domains": [
    "healthcare", "fintech", "banking", "insurance",
    "aerospace", "defense", "government", "federal",
    "pharmaceutical", "biotech", "life sciences",
    "manufacturing", "retail", "e-commerce",
    "telecommunications", "media", "entertainment",
    "legal", "real estate", "education", "edtech",
    "energy", "oil and gas", "utilities",
    "automotive", "transportation",
  ],
  "Certifications": [
    "cissp", "cism", "cisa", "ceh", "oscp", "comptia security+", "security+",
    "comptia network+", "aws certified", "azure certified", "gcp certified",
    "ccna", "ccnp", "itil certified",
    "certified scrum master", "csm", "psm",
    "togaf", "sabsa",
  ],
  "Testing & QA": [
    "testing", "unit testing", "integration testing", "e2e testing",
    "test automation", "selenium", "cypress", "playwright",
    "qa", "quality assurance", "performance testing", "load testing",
    "manual testing", "regression testing",
  ],
  "Networking": [
    "networking", "tcp/ip", "dns", "dhcp", "vpn",
    "routing", "switching", "wan", "lan", "sd-wan",
    "wireless", "802.1x",
  ],
  "Mobile": [
    "ios", "android", "react native", "flutter", "mobile development",
    "app development",
  ],
};

const SKILL_KEYWORDS = Object.values(SKILL_CATEGORIES).flat();

const KEYWORD_TO_CATEGORY: Record<string, string> = {};
for (const [cat, keywords] of Object.entries(SKILL_CATEGORIES)) {
  for (const kw of keywords) {
    KEYWORD_TO_CATEGORY[kw] = cat;
  }
}

/** Extract raw skill keywords from text */
export function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const sorted = [...SKILL_KEYWORDS].sort((a, b) => b.length - a.length);
  const found: string[] = [];
  const foundLower = new Set<string>();

  for (const kw of sorted) {
    if (foundLower.has(kw)) continue;
    if (kw.includes(" ") || kw.includes("/")) {
      if (lower.includes(kw)) {
        found.push(kw);
        foundLower.add(kw);
      }
    } else {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(lower)) {
        found.push(kw);
        foundLower.add(kw);
      }
    }
  }
  return found;
}

/** Extract skills with their categories */
export function extractSkillsWithCategories(text: string): { skill: string; category: string }[] {
  const keywords = extractKeywords(text);
  return keywords.map((kw) => ({
    skill: kw.charAt(0).toUpperCase() + kw.slice(1),
    category: KEYWORD_TO_CATEGORY[kw] || "Other",
  }));
}

/** Extract skills as a simple string array */
export function extractSkillsFromText(text: string): string[] {
  return extractKeywords(text).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

/** Score overlap between job keywords and resume keywords */
export function scoreOverlap(jobKeywords: string[], resumeKeywords: string[]): number {
  if (jobKeywords.length === 0) return 65;
  const matched = jobKeywords.filter((k) => resumeKeywords.includes(k)).length;
  return Math.round(Math.min(98, (matched / jobKeywords.length) * 100));
}

/** Get category for a keyword */
export function getCategoryForKeyword(keyword: string): string {
  return KEYWORD_TO_CATEGORY[keyword] || "Other";
}

/** Get all skill categories */
export function getSkillCategories(): Record<string, string[]> {
  return { ...SKILL_CATEGORIES };
}
