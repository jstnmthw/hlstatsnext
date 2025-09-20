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

// Plugin information
#define PLUGIN_NAME "HLStatsNext"
#define PLUGIN_VERSION "0.1.0"
#define PLUGIN_AUTHOR "d3m0n"

// Plugin lifecycle
public plugin_init() {
    // Register plugin
    register_plugin(PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR);

    // Initialize core systems
    hlstatsnext_core_init();
    hlstatsnext_colors_init();
    hlstatsnext_commands_init();

    // Register our commands
    register_hlstatsnext_commands();

    // Log plugin initialization
    log_amx("[%s] Plugin initialized successfully (v%s)", PLUGIN_NAME, PLUGIN_VERSION);

    return PLUGIN_CONTINUE;
}

public plugin_cfg() {
    // Load configuration after server config is loaded
    hlstatsnext_load_config();

    return PLUGIN_CONTINUE;
}

public plugin_end() {
    // Cleanup
    hlstatsnext_cleanup();
    log_amx("[%s] Plugin terminated", PLUGIN_NAME);
}

// Client connection events
public client_connect(id) {
    hlstatsnext_client_connect(id);
}

public client_disconnect(id) {
    hlstatsnext_client_disconnect(id);
}