package server

import (
	"strings"
	"testing"
)

func TestPrepareJSXSource(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		source   string
		contains []string
	}{
		{
			name: "named default function",
			source: `export default function DemoApp() {
  return <div>Hello</div>;
}`,
			contains: []string{
				"function DemoApp()",
				"const __artifactDefault = DemoApp;",
			},
		},
		{
			name: "named export reference",
			source: `function RetroLauncher() {
  return <div>Hello</div>;
}

export default RetroLauncher;
`,
			contains: []string{
				"function RetroLauncher()",
				"const __artifactDefault = RetroLauncher;",
			},
		},
		{
			name: "anonymous default function",
			source: `export default function() {
  return <div>Hello</div>;
}`,
			contains: []string{
				"const __artifactDefault = function()",
			},
		},
		{
			name: "default expression",
			source: `const Demo = () => <div>Hello</div>;
export default memo(Demo);
`,
			contains: []string{
				"const __artifactDefault = memo(Demo);",
			},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := prepareJSXSource(tt.source)
			if err != nil {
				t.Fatalf("prepareJSXSource returned error: %v", err)
			}
			if strings.Contains(got, "export default") {
				t.Fatalf("prepareJSXSource left export default in output: %q", got)
			}
			for _, want := range tt.contains {
				if !strings.Contains(got, want) {
					t.Fatalf("expected output to contain %q, got %q", want, got)
				}
			}
		})
	}
}

func TestMountJSXSourceAddsMountCode(t *testing.T) {
	t.Parallel()

	got, err := mountJSXSource(`export default () => <div>Hello</div>;`)
	if err != nil {
		t.Fatalf("mountJSXSource returned error: %v", err)
	}
	for _, want := range []string{
		`import React from "react";`,
		`import { createRoot } from "react-dom/client";`,
		`root.render(React.createElement(__artifactDefault));`,
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected mounted source to contain %q, got %q", want, got)
		}
	}
}
