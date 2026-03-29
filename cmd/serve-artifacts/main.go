package main

import (
	"github.com/go-go-golems/glazed/pkg/cli"
	"github.com/go-go-golems/glazed/pkg/cmds/logging"
	"github.com/go-go-golems/glazed/pkg/help"
	help_cmd "github.com/go-go-golems/glazed/pkg/help/cmd"
	"github.com/go-go-golems/serve-artifacts/cmd/serve-artifacts/cmds"
	"github.com/go-go-golems/serve-artifacts/cmd/serve-artifacts/doc"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "serve-artifacts",
	Short: "Serve Claude.ai artifacts from a local directory",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		return logging.InitLoggerFromCobra(cmd)
	},
}

func main() {
	err := logging.AddLoggingSectionToRootCommand(rootCmd, "serve-artifacts")
	cobra.CheckErr(err)

	helpSystem := help.NewHelpSystem()
	err = doc.AddDocToHelpSystem(helpSystem)
	cobra.CheckErr(err)
	help_cmd.SetupCobraRootCommand(helpSystem, rootCmd)

	// Register serve command (plain Cobra — long-running server)
	rootCmd.AddCommand(cmds.NewServeCmd())

	// Register list command (Glazed — structured output)
	listCmd, err := cmds.NewListCommand()
	cobra.CheckErr(err)
	cobraListCmd, err := cli.BuildCobraCommand(listCmd,
		cli.WithParserConfig(cli.CobraParserConfig{AppName: "serve-artifacts"}),
	)
	cobra.CheckErr(err)
	rootCmd.AddCommand(cobraListCmd)

	_ = rootCmd.Execute()
}
