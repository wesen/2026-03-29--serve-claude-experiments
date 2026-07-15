package cmds

import (
	"os"

	"github.com/go-go-golems/serve-artifacts/pkg/server"
	"github.com/spf13/cobra"
)

func NewServeCmd() *cobra.Command {
	var port int
	var dir string
	var watch bool
	var db string
	var thumbs string
	var noThumbs bool
	// Default from the environment so a container can enable it without changing
	// the command line (Chrome needs --no-sandbox when running as root).
	noSandbox := os.Getenv("SERVE_ARTIFACTS_CHROME_NO_SANDBOX") == "1"
	// The write API's shared bearer token; from the environment so a k8s Secret can
	// inject it without exposing it on the command line.
	writeToken := os.Getenv("SERVE_ARTIFACTS_WRITE_TOKEN")

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the artifact server",
		Long: `Start an HTTP server that serves Claude.ai artifacts.

HTML artifacts are served directly. JSX artifacts are wrapped in a host
page that provides React and a hybrid execution path: unchanged known
artifacts can use an embedded precompiled bundle, while changed or newly
added files fall back to Babel for in-browser transformation.

Use --watch to enable auto-reload: the server watches the artifact directory
for changes and pushes reload events to connected browsers via SSE.

Examples:
  serve-artifacts serve --dir ./imports --port 8080
  serve-artifacts serve --dir ~/claude-artifacts --watch`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := server.Config{
				Dir:             dir,
				Port:            port,
				Watch:           watch,
				DBPath:          db,
				ThumbsDir:       thumbs,
				NoThumbs:        noThumbs,
				ChromeNoSandbox: noSandbox,
				WriteToken:      writeToken,
			}
			srv, err := server.New(cfg)
			if err != nil {
				return err
			}
			return srv.Run(cmd.Context())
		},
	}

	cmd.Flags().IntVarP(&port, "port", "p", 8080, "Port to listen on")
	cmd.Flags().StringVarP(&dir, "dir", "d", ".", "Directory containing artifacts")
	cmd.Flags().BoolVarP(&watch, "watch", "w", false, "Watch for file changes and auto-reload browsers")
	cmd.Flags().StringVar(&db, "db", "", "SQLite database for favorites/tags/collections (default: user config dir)")
	cmd.Flags().StringVar(&thumbs, "thumbs", "", "Thumbnail cache directory (default: user cache dir)")
	cmd.Flags().BoolVar(&noThumbs, "no-thumbnails", false, "Disable thumbnail generation (no headless Chrome)")
	cmd.Flags().BoolVar(&noSandbox, "chrome-no-sandbox", noSandbox, "Run headless Chrome with --no-sandbox (needed to render as root in a container)")
	cmd.Flags().StringVar(&writeToken, "write-token", writeToken, "Shared bearer token required for write API calls (default $SERVE_ARTIFACTS_WRITE_TOKEN; empty = writes open)")

	return cmd
}
