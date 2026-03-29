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
