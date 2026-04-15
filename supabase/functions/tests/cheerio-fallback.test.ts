/**
 * Unit tests — cheerio-fallback.ts
 *
 * Run with:  deno test tests/cheerio-fallback.test.ts
 */

import {
  assertEquals,
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  extractWithCheerio,
  looksLikeJobDescription,
} from "../_shared/cheerio-fallback.ts";

// ---------------------------------------------------------------------------
// looksLikeJobDescription
// ---------------------------------------------------------------------------
Deno.test("looksLikeJobDescription: true for rich job text", () => {
  const text =
    "We are looking for a skilled Software Engineer to join our team. " +
    "The ideal candidate has 5+ years of experience with TypeScript and React. " +
    "Responsibilities include designing scalable systems, leading code reviews, " +
    "mentoring junior developers. Requirements: strong problem-solving skills, " +
    "familiarity with cloud platforms. Please apply with your resume. " +
    "Salary: $140,000–$180,000. Excellent benefits including health insurance.";
  assertEquals(looksLikeJobDescription(text), true);
});

Deno.test("looksLikeJobDescription: false for short text", () => {
  assertEquals(looksLikeJobDescription("We are hiring engineers."), false);
});

Deno.test("looksLikeJobDescription: false for unrelated text", () => {
  const text =
    "Welcome to our website. Click here to learn more about our products. " +
    "Contact us at info@example.com. © 2024 Example Corp. All rights reserved. " +
    "Privacy Policy | Terms of Service | Cookie Policy | Accessibility Statement.";
  assertEquals(looksLikeJobDescription(text), false);
});

// ---------------------------------------------------------------------------
// extractWithCheerio — HTML fixtures
// ---------------------------------------------------------------------------

const GREENHOUSE_HTML = `
<html>
<head><title>Software Engineer at Acme</title></head>
<body>
  <nav>Nav stuff</nav>
  <div id="content">
    <h1>Software Engineer</h1>
    <div class="job__description">
      <p>Join our team as a Software Engineer. We are looking for an experienced candidate.</p>
      <h2>Responsibilities</h2>
      <ul>
        <li>Design and build scalable backend services</li>
        <li>Collaborate with cross-functional teams</li>
        <li>Participate in code reviews and mentor junior developers</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>5+ years of experience with TypeScript or Go</li>
        <li>Strong understanding of distributed systems</li>
        <li>Excellent communication skills</li>
      </ul>
      <p>Benefits: Health, Dental, Vision. Salary: $150k-$190k. Apply today!</p>
    </div>
  </div>
  <footer>Footer content</footer>
</body>
</html>
`;

Deno.test("extractWithCheerio: Greenhouse ATS selector", async () => {
  const result = await extractWithCheerio(
    GREENHOUSE_HTML,
    "https://boards.greenhouse.io/acme/jobs/123"
  );
  assert(result.ok, "Expected ok=true");
  assertEquals(result.usedFallback, true);
  assert(result.strategy?.startsWith("ats:"), `Expected ATS strategy, got: ${result.strategy}`);
  assertStringIncludes(result.text, "Software Engineer");
  assertStringIncludes(result.text, "Responsibilities");
});

const GENERIC_MAIN_HTML = `
<html>
<head><title>Product Manager – TechCo</title></head>
<body>
  <header>Header</header>
  <main>
    <h1>Product Manager</h1>
    <p>We are seeking a talented Product Manager to lead our product team.</p>
    <h2>Responsibilities</h2>
    <p>Define product vision, roadmap, and strategy. Work with engineering and design teams.</p>
    <h2>Qualifications</h2>
    <p>5+ years of product management experience. Strong analytical and communication skills.</p>
    <p>Competitive salary and benefits package. Please apply by sending your resume.</p>
  </main>
  <footer>Footer</footer>
</body>
</html>
`;

Deno.test("extractWithCheerio: generic <main> selector", async () => {
  const result = await extractWithCheerio(
    GENERIC_MAIN_HTML,
    "https://techco.com/careers/pm"
  );
  assert(result.ok, "Expected ok=true");
  assert(
    result.strategy === "ats:main" || result.strategy?.startsWith("generic:main"),
    `Unexpected strategy: ${result.strategy}`
  );
  assertEquals(result.title, "Product Manager – TechCo");
  assertStringIncludes(result.text, "Product Manager");
  assertStringIncludes(result.text, "Responsibilities");
});

const NOISY_HTML = `
<html>
<head><title>Cookie Consent</title></head>
<body>
  <nav>Home | Jobs | About | Contact</nav>
  <div id="cookie-banner">We use cookies. Accept | Decline</div>
  <div class="job-description">
    <h1>Data Engineer</h1>
    <p>Looking for an experienced Data Engineer to join our data team.</p>
    <h2>Key Responsibilities</h2>
    <ul>
      <li>Build and maintain data pipelines</li>
      <li>Collaborate with analysts and scientists</li>
      <li>Ensure data quality and reliability</li>
    </ul>
    <h2>Requirements</h2>
    <ul>
      <li>3+ years experience with Python and SQL</li>
      <li>Familiarity with Spark, Airflow, or similar tools</li>
    </ul>
    <p>Salary: $120k–$160k. Great team and benefits. Apply now!</p>
  </div>
  <footer>© 2024 Corp. Privacy | Terms</footer>
</body>
</html>
`;

Deno.test("extractWithCheerio: .job-description class selector", async () => {
  const result = await extractWithCheerio(
    NOISY_HTML,
    "https://example.com/jobs/data-engineer"
  );
  assert(result.ok, "Expected ok=true");
  assertStringIncludes(result.text, "Data Engineer");
  assertStringIncludes(result.text, "Responsibilities");
  // Should NOT contain nav or footer noise
  assert(!result.text.includes("Privacy | Terms"), "Should strip footer");
});

const EMPTY_HTML = `
<html><head><title>404 Not Found</title></head>
<body><p>Page not found.</p></body>
</html>
`;

Deno.test("extractWithCheerio: returns ok=false for empty/useless page", async () => {
  const result = await extractWithCheerio(
    EMPTY_HTML,
    "https://example.com/404"
  );
  assertEquals(result.ok, false);
});

Deno.test("extractWithCheerio: handles malformed HTML gracefully", async () => {
  // Should not throw
  const result = await extractWithCheerio(
    "<html><b>unclosed tag <p>text",
    "https://example.com/jobs/broken"
  );
  // Just verify it doesn't throw — ok can be either true or false
  assertEquals(typeof result.ok, "boolean");
});

Deno.test("extractWithCheerio: strips script and style tags", async () => {
  const html = `
    <html><body>
      <script>alert('xss')</script>
      <style>body { color: red }</style>
      <main>
        <h1>Senior Engineer</h1>
        <p>We have an exciting opportunity for a Senior Engineer. Join our team!</p>
        <p>Key responsibilities include system design and mentoring. Requirements: 7+ years experience.</p>
        <p>Excellent skills required. Apply today to be considered for this role.</p>
      </main>
    </body></html>
  `;
  const result = await extractWithCheerio(html, "https://example.com/job");
  assert(!result.text.includes("alert('xss')"), "Should strip script content");
  assert(!result.text.includes("color: red"), "Should strip style content");
});
