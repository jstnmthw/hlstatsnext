/*
 * HLStatsNext AMX Mod X Plugin
 *
 * Author: HLStatsNext Team
 * Version: 1.0.0
 *
 */

// AMX optimization directives
#pragma semicolon 1  // Enforce semicolons to reduce memory usage
#pragma compress 1   // Enable binary compression for smaller file size

#include <amxmodx>
#include <amxmisc>

// Include our custom modules
#include "include/hlstatsnext_core.inc"
#include "include/hlstatsnext_colors.inc"
#include "include/hlstatsnext_util.inc"
#include "include/hlstatsnext_events.inc"
#include "include/hlstatsnext_commands.inc"
#include "include/hlstatsnext_hud.inc"
#include "include/hlstatsnext_auth.inc"

// Plugin information
#define PLUGIN_NAME    "HLStatsNext"
#define PLUGIN_VERSION "1.0.0"
#define PLUGIN_AUTHOR  "d3m0n"

// Plugin lifecycle
public plugin_init()
{
  // Register plugin
  register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR);

  // Register all cvars (core, auth, HUD)
  hlstatsnext_core_init();
  hlstatsnext_colors_init();
  hlstatsnext_commands_init();
  hlstatsnext_auth_init();

  // Auto-generate and exec config at configs/hlstatsnext.cfg
  AutoExecConfig(true, "hlstatsnext", "");

  // Register our commands
  register_hlstatsnext_commands();

  // Register player say commands
  register_clcmd("say", "handle_say");
  register_clcmd("say_team", "handle_say");

  // Log plugin initialization
  log_amx("[%s] Plugin initialized successfully (v%s)", PLUGIN_NAME, PLUGIN_VERSION);

  return PLUGIN_CONTINUE;
}

// Called after all config files have been executed, including
// AutoExecConfig files (configs/plugins/hlstatsnext.cfg).
// Cvars now have their final values — safe to read them.
//
// NOTE: OnConfigsExecuted() is the correct forward to pair with
// AutoExecConfig(). plugin_cfg() fires BEFORE AutoExecConfig files
// execute, so cvars would still have defaults at that point.
// Requires AMX Mod X 1.8.3+ (we run 1.10.x).
public OnConfigsExecuted()
{
  // Apply cvar values to plugin state
  hlstatsnext_apply_config();

  // Start auth beacon (hlx_token cvar is now populated)
  hlstatsnext_auth_start();
}

public plugin_end()
{
  // Stop auth beacon before cleanup
  hlstatsnext_auth_stop();

  // Cleanup
  hlstatsnext_cleanup();
  log_amx("[%s] Plugin terminated", PLUGIN_NAME);
}

// Client connection events
public client_connect(id)
{
  hlstatsnext_client_connect(id);
}

// Client disconnection events
public client_disconnected(id)
{
  hlstatsnext_client_disconnect(id);
}

// Handle player say/say_team commands
public handle_say(id)
{
  new said[192];
  read_args(said, charsmax(said));
  remove_quotes(said);

  // Check if it's a command (starts with ! or /)
  if (said[0] != '!' && said[0] != '/')
  {
    return PLUGIN_CONTINUE;
  }

  // Get the command (remove the ! or /)
  new command[32];
  strtok(said[1], command, charsmax(command), said, charsmax(said), ' ');

  // Convert to lowercase manually - AMX optimization: cache strlen()
  new len = strlen(command);
  for (new i = 0; i < len; i++)
  {
    if (command[i] >= 'A' && command[i] <= 'Z')
    {
      command[i] += 32;
    }
  }

  // Handle help command with consistent formatting (local command) - AMX optimization: use equal()
  if (equal(command, "help"))
  {
    new formatted_tag[32];
    format_colored_tag(formatted_tag, charsmax(formatted_tag));
    client_print_color(id, print_team_red, "%s Commands: !rank, !stats, !session, !help", formatted_tag);
    return PLUGIN_HANDLED;
  }

  // Let other commands pass through to be logged and handled by daemon
  return PLUGIN_CONTINUE;
}
