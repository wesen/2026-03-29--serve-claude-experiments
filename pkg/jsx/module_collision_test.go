package jsx

import (
	"strings"
	"testing"
)

func TestBuildModuleSourceNoDoubleReactImport(t *testing.T) {
	// Artifact that already imports React as a default binding (modern format).
	src := "import React, { useState } from \"react\";\nexport default function App(){ return <div/>; }\n"
	out, err := BuildModuleSource(src)
	if err != nil {
		t.Fatalf("BuildModuleSource: %v", err)
	}
	if n := strings.Count(out, "import React"); n != 1 {
		t.Fatalf("expected exactly one 'import React' (the artifact's own), got %d:\n%s", n, out)
	}
	if strings.Contains(out, "import React from \"react\";\nimport React") {
		t.Fatalf("injected a colliding React import")
	}
}

func TestBuildModuleSourceInjectsReactWhenAbsent(t *testing.T) {
	// Artifact importing only named hooks needs the injected default React.
	src := "import { useState } from \"react\";\nexport default function App(){ return <div/>; }\n"
	out, err := BuildModuleSource(src)
	if err != nil {
		t.Fatalf("BuildModuleSource: %v", err)
	}
	if !strings.Contains(out, "import React from \"react\";") {
		t.Fatalf("expected injected default React import when absent:\n%s", out)
	}
}

func TestBuildModuleSourceMultilineReactImport(t *testing.T) {
	src := "import React, {\n  useState,\n  useEffect,\n} from \"react\";\nexport default function App(){ return <div/>; }\n"
	out, err := BuildModuleSource(src)
	if err != nil {
		t.Fatalf("BuildModuleSource: %v", err)
	}
	if n := strings.Count(out, "import React"); n != 1 {
		t.Fatalf("multi-line React import should not be doubled, got %d imports:\n%s", n, out)
	}
}
