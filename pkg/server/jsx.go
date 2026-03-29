package server

import (
	"fmt"
	"regexp"
	"strings"
)

const jsxDefaultBinding = "__artifactDefault"

var defaultExportNamedFunctionRe = regexp.MustCompile(`(?m)export\s+default\s+function\s+([A-Za-z_]\w*)\s*\(`)
var defaultExportNamedClassRe = regexp.MustCompile(`(?m)export\s+default\s+class\s+([A-Za-z_]\w*)\b`)
var defaultExportIdentifierRe = regexp.MustCompile(`(?m)export\s+default\s+([A-Za-z_]\w*)\s*;`)
var defaultExportAnonymousFunctionRe = regexp.MustCompile(`(?m)export\s+default\s+function\s*\(`)
var defaultExportAnonymousClassRe = regexp.MustCompile(`(?m)export\s+default\s+class\b`)
var defaultExportExpressionRe = regexp.MustCompile(`(?m)export\s+default\s+`)

func prepareJSXSource(source string) (string, error) {
	switch {
	case defaultExportNamedFunctionRe.MatchString(source):
		transformed := defaultExportNamedFunctionRe.ReplaceAllString(source, "function $1(")
		name := defaultExportNamedFunctionRe.FindStringSubmatch(source)[1]
		return transformed + "\n\nconst " + jsxDefaultBinding + " = " + name + ";\n", nil
	case defaultExportNamedClassRe.MatchString(source):
		transformed := defaultExportNamedClassRe.ReplaceAllString(source, "class $1")
		name := defaultExportNamedClassRe.FindStringSubmatch(source)[1]
		return transformed + "\n\nconst " + jsxDefaultBinding + " = " + name + ";\n", nil
	case defaultExportIdentifierRe.MatchString(source):
		return defaultExportIdentifierRe.ReplaceAllString(source, "const "+jsxDefaultBinding+" = $1;"), nil
	case defaultExportAnonymousFunctionRe.MatchString(source):
		return defaultExportAnonymousFunctionRe.ReplaceAllString(source, "const "+jsxDefaultBinding+" = function("), nil
	case defaultExportAnonymousClassRe.MatchString(source):
		return defaultExportAnonymousClassRe.ReplaceAllString(source, "const "+jsxDefaultBinding+" = class"), nil
	case defaultExportExpressionRe.MatchString(source):
		return defaultExportExpressionRe.ReplaceAllString(source, "const "+jsxDefaultBinding+" = "), nil
	default:
		return "", fmt.Errorf("unsupported JSX default export: expected a recognizable export default form")
	}
}

func mountJSXSource(source string) (string, error) {
	transformed, err := prepareJSXSource(source)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	b.WriteString("import React from \"react\";\n")
	b.WriteString(transformed)
	b.WriteString(`

// Auto-mount the default export
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
`)
	return b.String(), nil
}
