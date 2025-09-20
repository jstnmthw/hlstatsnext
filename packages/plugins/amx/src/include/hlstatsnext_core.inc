/*
 * HLStatsNext Core Module
 *
 * Core functionality and plugin lifecycle management
 */

#if defined _hlstatsnext_core_included
    #endinput
#endif
#define _hlstatsnext_core_included

// Core constants
#define HLSTATSNEXT_MAX_MESSAGE_LENGTH 191
#define HLSTATSNEXT_MAX_PLAYERS 32
#define HLSTATSNEXT_CONFIG_FILE "hlstatsnext.cfg"

// Plugin state
enum HLStatsNextState {
    STATE_LOADING,
    STATE_ACTIVE,
    STATE_ERROR,
    STATE_DISABLED
}

// Global state variables
new HLStatsNextState:g_plugin_state = STATE_LOADING;
new bool:g_plugin_enabled = true;
new bool:g_debug_mode = false;
new g_server_id = 0;

// Core initialization
stock hlstatsnext_core_init() {
    g_plugin_state = STATE_LOADING;

    // Set default values
    g_plugin_enabled = true;
    g_debug_mode = false;

    log_amx("[HLStatsNext] Core initialized");
}

// Configuration loading
stock hlstatsnext_load_config() {
    new config_file[128];
    get_configsdir(config_file, charsmax(config_file));
    format(config_file, charsmax(config_file), "%s/%s", config_file, HLSTATSNEXT_CONFIG_FILE);

    if (file_exists(config_file)) {
        // Load configuration from file
        load_config_file(config_file);
        log_amx("[HLStatsNext] Configuration loaded from %s", config_file);
    } else {
        log_amx("[HLStatsNext] Configuration file not found, using defaults");
    }

    g_plugin_state = g_plugin_enabled ? STATE_ACTIVE : STATE_DISABLED;
}

// Configuration file parser
stock load_config_file(const config_file[]) {
    new file = fopen(config_file, "rt");
    if (!file) {
        return;
    }

    new line[256], key[64], value[192];

    while (fgets(file, line, charsmax(line))) {
        trim(line);

        // Skip comments and empty lines
        if (line[0] == '/' && line[1] == '/' || line[0] == '#' || line[0] == EOS) {
            continue;
        }

        // Parse key=value pairs
        if (parse(line, key, charsmax(key), value, charsmax(value)) == 2) {
            process_config_option(key, value);
        }
    }

    fclose(file);
}

// Process individual configuration options
stock process_config_option(const key[], const value[]) {
    if (equal(key, "hlstatsnext_enabled")) {
        g_plugin_enabled = bool:str_to_num(value);
    } else if (equal(key, "hlstatsnext_debug")) {
        g_debug_mode = bool:str_to_num(value);
    } else if (equal(key, "hlstatsnext_server_id")) {
        g_server_id = str_to_num(value);
    }
    // Add more configuration options as needed
}

// Client event handlers
stock hlstatsnext_client_connect(id) {
    if (g_debug_mode) {
        new name[32];
        get_user_name(id, name, charsmax(name));
        log_amx("[HLStatsNext] Client connected: %s (ID: %d)", name, id);
    }
}

stock hlstatsnext_client_disconnect(id) {
    if (g_debug_mode) {
        new name[32];
        get_user_name(id, name, charsmax(name));
        log_amx("[HLStatsNext] Client disconnected: %s (ID: %d)", name, id);
    }
}

// Cleanup function
stock hlstatsnext_cleanup() {
    g_plugin_state = STATE_DISABLED;
    log_amx("[HLStatsNext] Core cleanup completed");
}

// Utility functions
stock bool:is_plugin_active() {
    return g_plugin_state == STATE_ACTIVE;
}

stock bool:is_debug_enabled() {
    return g_debug_mode;
}

stock get_server_id() {
    return g_server_id;
}