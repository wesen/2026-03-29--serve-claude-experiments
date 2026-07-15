package artifacts

import "testing"

func TestExtractJSXComponentNameFromSource(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		source   string
		expected string
	}{
		{
			name: "named default function",
			source: `import { useState } from "react";
export default function DemoApp() {
  return <div>Hello</div>;
}`,
			expected: "DemoApp",
		},
		{
			name: "named function exported later",
			source: `function RetroLauncher() {
  return <div>Hello</div>;
}

export default RetroLauncher;
`,
			expected: "RetroLauncher",
		},
		{
			name: "named const exported later",
			source: `const LogicAnalyzer = () => {
  return <div>Hello</div>;
};

export default LogicAnalyzer;
`,
			expected: "LogicAnalyzer",
		},
		{
			name: "named class export",
			source: `export default class DemoView extends React.Component {
  render() {
    return <div>Hello</div>;
  }
}`,
			expected: "DemoView",
		},
		{
			name:     "anonymous export falls back",
			source:   `export default () => <div>Hello</div>;`,
			expected: "",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := extractJSXComponentNameFromSource(tt.source)
			if got != tt.expected {
				t.Fatalf("expected %q, got %q", tt.expected, got)
			}
		})
	}
}

func TestPlausibleModel(t *testing.T) {
	// Model release date after the conversation's last activity → dropped (API default).
	if got := plausibleModel("claude-sonnet-4-5-20250929", "2024-12-07T00:00:00Z"); got != "" {
		t.Fatalf("future-dated model should be dropped, got %q", got)
	}
	// Model that existed by then → kept.
	if got := plausibleModel("claude-3-5-sonnet-20240620", "2024-12-07T00:00:00Z"); got != "claude-3-5-sonnet-20240620" {
		t.Fatalf("valid model dropped: %q", got)
	}
	// No date suffix → left as-is (can't verify).
	if got := plausibleModel("claude-opus-4-8", "2024-01-01T00:00:00Z"); got != "claude-opus-4-8" {
		t.Fatalf("suffixless model changed: %q", got)
	}
}
