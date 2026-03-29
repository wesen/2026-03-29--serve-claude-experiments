package server

import "github.com/go-go-golems/serve-artifacts/pkg/jsx"

func prepareJSXSource(source string) (string, error) {
	return jsx.PrepareSource(source)
}

func mountJSXSource(source string) (string, error) {
	return jsx.BuildModuleSource(source)
}
