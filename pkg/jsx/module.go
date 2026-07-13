package jsx

import (
	"fmt"
	"regexp"
	"strings"
)

const DefaultBinding = "__artifactDefault"

var defaultExportNamedFunctionRe = regexp.MustCompile(`(?m)export\s+default\s+function\s+([A-Za-z_]\w*)\s*\(`)
var defaultExportNamedClassRe = regexp.MustCompile(`(?m)export\s+default\s+class\s+([A-Za-z_]\w*)\b`)
var defaultExportIdentifierRe = regexp.MustCompile(`(?m)export\s+default\s+([A-Za-z_]\w*)\s*;`)
var defaultExportAnonymousFunctionRe = regexp.MustCompile(`(?m)export\s+default\s+function\s*\(`)
var defaultExportAnonymousClassRe = regexp.MustCompile(`(?m)export\s+default\s+class\b`)
var defaultExportExpressionRe = regexp.MustCompile(`(?m)export\s+default\s+`)

// defaultReactImportRe matches an artifact that already imports React as a default
// binding (`import React from "react"` or `import React, { ... } from "react"`).
// Modern Claude file-based artifacts include this; older ones relied on a global
// React. We must not inject a second `import React` in the former case, or Babel
// fails with "Identifier 'React' has already been declared".
// [^;]*? crosses newlines (a negated class matches \n), so this also matches a
// multi-line `import React, {\n  useState,\n} from "react";`.
var defaultReactImportRe = regexp.MustCompile(`import\s+React\b[^;]*?\bfrom\s+['"]react['"]`)

func PrepareSource(source string) (string, error) {
	switch {
	case defaultExportNamedFunctionRe.MatchString(source):
		transformed := defaultExportNamedFunctionRe.ReplaceAllString(source, "function $1(")
		name := defaultExportNamedFunctionRe.FindStringSubmatch(source)[1]
		return transformed + "\n\nconst " + DefaultBinding + " = " + name + ";\n", nil
	case defaultExportNamedClassRe.MatchString(source):
		transformed := defaultExportNamedClassRe.ReplaceAllString(source, "class $1")
		name := defaultExportNamedClassRe.FindStringSubmatch(source)[1]
		return transformed + "\n\nconst " + DefaultBinding + " = " + name + ";\n", nil
	case defaultExportIdentifierRe.MatchString(source):
		return defaultExportIdentifierRe.ReplaceAllString(source, "const "+DefaultBinding+" = $1;"), nil
	case defaultExportAnonymousFunctionRe.MatchString(source):
		return defaultExportAnonymousFunctionRe.ReplaceAllString(source, "const "+DefaultBinding+" = function("), nil
	case defaultExportAnonymousClassRe.MatchString(source):
		return defaultExportAnonymousClassRe.ReplaceAllString(source, "const "+DefaultBinding+" = class"), nil
	case defaultExportExpressionRe.MatchString(source):
		return defaultExportExpressionRe.ReplaceAllString(source, "const "+DefaultBinding+" = "), nil
	default:
		return "", fmt.Errorf("unsupported JSX default export: expected a recognizable export default form")
	}
}

func BuildModuleSource(source string) (string, error) {
	transformed, err := PrepareSource(source)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	// Only inject a default React import when the artifact does not already import
	// React itself; otherwise the two declarations collide.
	if !defaultReactImportRe.MatchString(source) {
		b.WriteString("import React from \"react\";\n")
	}
	b.WriteString(transformed)
	// Use aliased bindings for the auto-mount so they never clash with the
	// artifact's own imports (e.g. an artifact that imports createRoot).
	b.WriteString(`

// Auto-mount the default export
import { createRoot as __artifactCreateRoot } from "react-dom/client";
import * as __artifactReactNS from "react";
const __artifactRoot = __artifactCreateRoot(document.getElementById("root"));
__artifactRoot.render(__artifactReactNS.createElement(__artifactDefault));
`)
	return b.String(), nil
}
