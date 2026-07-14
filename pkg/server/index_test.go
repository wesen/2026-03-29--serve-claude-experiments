package server

import (
	"testing"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
)

func mkEntry(name, typ, project, model string, tags, libs []string, warnings int, hay string) indexEntry {
	w := make([]string, warnings)
	return indexEntry{
		art: artifacts.Artifact{
			Name: name, Title: name, Type: typ, Project: project, Model: model,
			Tags: tags, Warnings: w, SourceConversationUUID: "u-" + name,
		},
		libraries: libs,
		haystack:  hay,
	}
}

func testIndex() *searchIndex {
	return &searchIndex{entries: []indexEntry{
		mkEntry("alpha", "jsx", "P1", "opus", []string{"chart"}, []string{"recharts"}, 0, "alpha chart dashboard"),
		mkEntry("beta", "jsx", "P1", "opus", []string{"ui"}, nil, 1, "beta window manager"),
		mkEntry("gamma", "html", "", "sonnet", nil, nil, 0, "gamma static document"),
	}}
}

func TestExtractLibraries(t *testing.T) {
	src := `import React from "react";
import { LineChart } from "recharts";
import x from "./local";
import d3 from "d3/selection";
import { motion } from "framer-motion";`
	libs := extractLibraries(src)
	want := map[string]bool{"recharts": true, "d3": true, "framer-motion": true}
	if len(libs) != 3 {
		t.Fatalf("libs = %v, want 3 (react and relative excluded)", libs)
	}
	for _, l := range libs {
		if !want[l] {
			t.Fatalf("unexpected library %q in %v", l, libs)
		}
	}
	if got := packageRoot("@scope/pkg/deep"); got != "@scope/pkg" {
		t.Fatalf("scoped package root = %q", got)
	}
}

func TestSearchTextAndFilters(t *testing.T) {
	ix := testIndex()

	// free-text AND semantics
	if r := ix.search(searchQuery{Q: "window"}, userView{}); r.Total != 1 || r.Results[0].Name != "beta" {
		t.Fatalf("text search failed: %+v", r)
	}
	// type filter
	if r := ix.search(searchQuery{Type: "html"}, userView{}); r.Total != 1 || r.Results[0].Name != "gamma" {
		t.Fatalf("type filter failed: %+v", r)
	}
	// library filter
	if r := ix.search(searchQuery{Library: "recharts"}, userView{}); r.Total != 1 || r.Results[0].Name != "alpha" {
		t.Fatalf("library filter failed: %+v", r)
	}
	// warnings filter
	if r := ix.search(searchQuery{Warnings: true}, userView{}); r.Total != 1 || r.Results[0].Name != "beta" {
		t.Fatalf("warnings filter failed: %+v", r)
	}
	// tag filter
	if r := ix.search(searchQuery{Tags: []string{"chart"}}, userView{}); r.Total != 1 || r.Results[0].Name != "alpha" {
		t.Fatalf("tag filter failed: %+v", r)
	}
}

func TestFacetExcludesOwnDimension(t *testing.T) {
	ix := testIndex()
	// Filter to type=jsx. The type facet must still show html's count (2 jsx, 1 html),
	// because a facet is counted against the results filtered by all OTHER dimensions.
	r := ix.search(searchQuery{Type: "jsx"}, userView{})
	if r.Facets["type"]["jsx"] != 2 || r.Facets["type"]["html"] != 1 {
		t.Fatalf("type facet should ignore its own filter: %v", r.Facets["type"])
	}
	// But the project facet, computed under type=jsx, should only count jsx rows.
	if r.Facets["project"]["P1"] != 2 {
		t.Fatalf("project facet under type=jsx: %v", r.Facets["project"])
	}
	if _, ok := r.Facets["project"][facetNone]; ok {
		t.Fatalf("html/no-project row should not appear in project facet under type=jsx: %v", r.Facets["project"])
	}
}

func TestSearchFavoriteFilterAndFacet(t *testing.T) {
	ix := testIndex()
	uv := userView{favorites: map[string]bool{"beta": true}}
	// favorite filter keeps only favorited entries
	r := ix.search(searchQuery{Favorite: true}, uv)
	if r.Total != 1 || r.Results[0].Name != "beta" || !r.Results[0].Favorite {
		t.Fatalf("favorite filter failed: %+v", r)
	}
	// favorite facet counts favorites in the (unfiltered) set
	all := ix.search(searchQuery{}, uv)
	if all.Facets["favorite"]["true"] != 1 {
		t.Fatalf("favorite facet = %v", all.Facets["favorite"])
	}
	// enrichment: beta is favorite, others are not
	for _, d := range all.Results {
		if (d.Name == "beta") != d.Favorite {
			t.Fatalf("favorite enrichment wrong for %s: %v", d.Name, d.Favorite)
		}
	}
}

func TestSearchMergesUserTags(t *testing.T) {
	ix := testIndex()
	uv := userView{tags: map[string][]string{"gamma": {"starred"}}}
	// user tag is filterable and appears in results/facets
	r := ix.search(searchQuery{Tags: []string{"starred"}}, uv)
	if r.Total != 1 || r.Results[0].Name != "gamma" {
		t.Fatalf("user-tag filter failed: %+v", r)
	}
	if !containsFold(r.Results[0].Tags, "starred") {
		t.Fatalf("merged tags missing user tag: %v", r.Results[0].Tags)
	}
}
