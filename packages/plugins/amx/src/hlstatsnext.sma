/*
 * HLStatsNext AMX Mod X Plugin
 *
 * Enhanced messaging system for HLStatsNext game statistics
 * Replaces vanilla amx_say with colored, formatted messages
 *
 * Author: HLStatsNext Team
 * Version: 1.0.0
 *
 * This plugin provides:
 * - Colored message formatting
 * - Clean message display (removes server prefixes)
 * - Extensible command system
 * - Integration with HLStatsNext daemon
 */

#include <amxmodx>
#include <amxmisc>

// Include our custom modules
#include "include/hlstatsnext_core.inc"
#include "include/hlstatsnext_colors.inc"
#include "include/hlstatsnext_util.inc"
#include "include/hlstatsnext_events.inc"
#include "include/hlstatsnext_parser.inc"
#include "include/hlstatsnext_formatter.inc"
#include "include/hlstatsnext_commands.inc"
// #include "include/hlstatsnext_player_commands.inc"

// Plugin information
#define PLUGIN_NAME    "HLStatsNext"
#define PLUGIN_VERSION "1.0.0"
#define PLUGIN_AUTHOR  "d3m0n"

// Plugin lifecycle
public plugin_init()
{
  // Register plugin
  register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR);

  // Initialize core systems
  hlstatsnext_core_init();
  hlstatsnext_colors_init();
  hlstatsnext_commands_init();
  // Register our commands
  register_hlstatsnext_commands();

  // Register player say commands
  register_clcmd("say", "handle_say");
  register_clcmd("say_team", "handle_say");

  // Log plugin initialization
  log_amx("[%s] Plugin initialized successfully (v%s)", PLUGIN_NAME, PLUGIN_VERSION);

  return PLUGIN_CONTINUE;
}

public plugin_cfg()
{
  // Load configuration after server config is loaded
  hlstatsnext_load_config();

  return PLUGIN_CONTINUE;
}

public plugin_end()
{
  // Cleanup
  hlstatsnext_cleanup();
  log_amx("[%s] Plugin terminated", PLUGIN_NAME);
}

// Client connection events
public client_connect(id)
{
  hlstatsnext_client_connect(id);
}

public client_disconnected(id)
{
  hlstatsnext_client_disconnect(id);
}

// Handle player say/say_team commands
public handle_say(id) {
  new said[192];
  read_args(said, charsmax(said));
  remove_quotes(said);

  // Check if it's a command (starts with ! or /)
  if (said[0] != '!' && said[0] != '/') {
    return PLUGIN_CONTINUE;
  }

  // Get the command (remove the ! or /)
  new command[32];
  strtok(said[1], command, charsmax(command), said, charsmax(said), ' ');

  // Convert to lowercase manually
  for (new i = 0; i < strlen(command); i++) {
    if (command[i] >= 'A' && command[i] <= 'Z') {
      command[i] += 32;
    }
  }

  // Handle help command
  if (command[0] == 'h' && command[1] == 'e' && command[2] == 'l' && command[3] == 'p') {
    client_print(id, print_chat, "[HLStatsNext]: Commands: !rank !stats !top10 !help");
    return PLUGIN_HANDLED;
  }

  // Just log that a command was received
  log_amx("Player %d used command: %s", id, command);

  return PLUGIN_HANDLED;
}