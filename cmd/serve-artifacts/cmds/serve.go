package cmds

import (
	"github.com/go-go-golems/serve-artifacts/pkg/server"
	"github.com/spf13/cobra"
)

func NewServeCmd() *cobra.Command {
	var port int
	var dir string
	var watch bool

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
				Dir:   dir,
				Port:  port,
				Watch: watch,
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

	return cmd
}
