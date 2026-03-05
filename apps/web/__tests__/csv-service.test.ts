import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// CSV parsing utility tests (extracted inline parser logic)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

function escapeCSV(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

describe("parseCSVLine", () => {
  it("parses simple CSV line", () => {
    expect(parseCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields", () => {
    expect(parseCSVLine('"hello, world",b,c')).toEqual([
      "hello, world",
      "b",
      "c",
    ]);
  });

  it("handles escaped quotes", () => {
    expect(parseCSVLine('"he said ""hi""",b')).toEqual(['he said "hi"', "b"]);
  });

  it("handles empty fields", () => {
    expect(parseCSVLine("a,,c")).toEqual(["a", "", "c"]);
  });

  it("handles single field", () => {
    expect(parseCSVLine("hello")).toEqual(["hello"]);
  });

  it("handles Japanese text", () => {
    expect(parseCSVLine("春の香り,5000,true")).toEqual([
      "春の香り",
      "5000",
      "true",
    ]);
  });
});

describe("escapeCSV", () => {
  it("returns plain string as-is", () => {
    expect(escapeCSV("hello")).toBe("hello");
  });

  it("wraps string with comma in quotes", () => {
    expect(escapeCSV("hello, world")).toBe('"hello, world"');
  });

  it("escapes inner quotes", () => {
    expect(escapeCSV('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("wraps string with newline in quotes", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });
});
