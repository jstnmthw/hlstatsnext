/*
 * HLStatsNext Core Module
 *
 * Core functionality, plugin lifecycle, and cvar registration.
 * All settings are engine cvars managed by AutoExecConfig.
 */

#if defined _hlstatsnext_core_included
    #endinput
#endif
#define _hlstatsnext_core_included

// Core constants
#define HLSTATSNEXT_MAX_MESSAGE_LENGTH 191
#define HLSTATSNEXT_MAX_PLAYERS 32
#define HLSTATSNEXT_TAG "[HLStatsNext]:"

// Plugin state
enum HLStatsNextState {
    STATE_LOADING,
    STATE_ACTIVE,
    STATE_ERROR,
    STATE_DISABLED
}

// Plugin state (not a cvar — derived from hlstatsnext_enabled)
new HLStatsNextState:g_plugin_state = STATE_LOADING;

// Cvar pointers (registered in hlstatsnext_core_init, populated by AutoExecConfig)
new g_pcvar_enabled;
new g_pcvar_debug;
new g_pcvar_server_id;
new g_pcvar_color_scheme;

// Core initialization — registers cvars. Called from plugin_init().
stock hlstatsnext_core_init() {
    g_plugin_state = STATE_LOADING;

    g_pcvar_enabled = create_cvar(
        "hlstatsnext_enabled", "1",
        FCVAR_NONE,
        "Enable or disable the HLStatsNext plugin (0 = disabled, 1 = enabled)",
        true, 0.0, true, 1.0
    );

    g_pcvar_debug = create_cvar(
        "hlstatsnext_debug", "0",
        FCVAR_NONE,
        "Enable debug logging (0 = off, 1 = on)",
        true, 0.0, true, 1.0
    );

    g_pcvar_server_id = create_cvar(
        "hlstatsnext_server_id", "0",
        FCVAR_NONE,
        "Server ID for identification (0 = auto-detect from daemon)"
    );

    g_pcvar_color_scheme = create_cvar(
        "hlstatsnext_color_scheme", "default",
        FCVAR_NONE,
        "Color scheme for chat messages (default, alternative)"
    );

    log_amx("%s Core initialized", HLSTATSNEXT_TAG);
}

// Apply configuration from cvars. Called from OnConfigsExecuted().
stock hlstatsnext_apply_config() {
    new bool:enabled = get_pcvar_num(g_pcvar_enabled) != 0;
    g_plugin_state = enabled ? STATE_ACTIVE : STATE_DISABLED;

    // Apply color scheme
    new scheme[32];
    get_pcvar_string(g_pcvar_color_scheme, scheme, charsmax(scheme));
    load_color_scheme(scheme);

    log_amx("%s Configuration applied (enabled: %d, debug: %d, server_id: %d, colors: %s)",
        HLSTATSNEXT_TAG,
        enabled,
        get_pcvar_num(g_pcvar_debug),
        get_pcvar_num(g_pcvar_server_id),
        scheme
    );
}

// Client event handlers
stock hlstatsnext_client_connect(id) {
    if (is_debug_enabled()) {
        new name[32];
        get_user_name(id, name, charsmax(name));
        log_amx("%s Client connected: %s (ID: %d)", HLSTATSNEXT_TAG, name, id);
    }
}

stock hlstatsnext_client_disconnect(id) {
    if (is_debug_enabled()) {
        new name[32];
        get_user_name(id, name, charsmax(name));
        log_amx("%s Client disconnected: %s (ID: %d)", HLSTATSNEXT_TAG, name, id);
    }
}

// Cleanup function
stock hlstatsnext_cleanup() {
    g_plugin_state = STATE_DISABLED;
    log_amx("%s Core cleanup completed", HLSTATSNEXT_TAG);
}

// Cvar accessors — read pcvars directly so console changes take effect immediately
stock bool:is_plugin_active() {
    return g_plugin_state == STATE_ACTIVE;
}

stock bool:is_debug_enabled() {
    return get_pcvar_num(g_pcvar_debug) != 0;
}

stock get_server_id() {
    return get_pcvar_num(g_pcvar_server_id);
}
