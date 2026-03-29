package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/go-go-golems/serve-artifacts/pkg/jsx"
)

func main() {
	dir := flag.String("dir", "", "Directory containing build-known JSX artifacts")
	out := flag.String("out", "", "Output directory for generated bundle files")
	flag.Parse()

	if *dir == "" || *out == "" {
		log.Fatal("both --dir and --out are required")
	}

	manifest, err := jsx.GenerateBundle(*dir, *out)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("generated %d precompiled JSX artifacts in %s\n", len(manifest.Entries), *out)
}
