/*
 * HLStatsNext Utility Module
 *
 * Utility functions and helpers
 */

#if defined _hlstatsnext_util_included
    #endinput
#endif
#define _hlstatsnext_util_included

// String utility functions
stock hlstatsnext_trim(string[]) {
    new len = strlen(string);

    // Trim trailing spaces
    while (len > 0 && string[len - 1] == ' ') {
        string[--len] = EOS;
    }

    // Trim leading spaces
    new start = 0;
    while (string[start] == ' ') {
        start++;
    }

    if (start > 0) {
        new i = 0;
        while (string[start + i] != EOS) {
            string[i] = string[start + i];
            i++;
        }
        string[i] = EOS;
    }
}

// Safe string copy with validation
stock safe_copy(dest[], maxlen, const source[]) {
    new len = strlen(source);
    if (len >= maxlen) {
        len = maxlen - 1;
    }

    for (new i = 0; i < len; i++) {
        dest[i] = source[i];
    }
    dest[len] = EOS;
}

// Debug logging function
stock debug_log(const format[], any:...) {
    if (!is_debug_enabled()) {
        return;
    }

    new message[256];
    vformat(message, charsmax(message), format, 2);
    log_amx("[HLStatsNext DEBUG] %s", message);
}

// Performance monitoring
stock Float:get_performance_time() {
    return get_gametime();
}

stock log_performance(const operation[], Float:start_time) {
    if (!is_debug_enabled()) {
        return;
    }

    new Float:elapsed = get_gametime() - start_time;
    log_amx("[HLStatsNext PERF] %s took %.3f seconds", operation, elapsed);
}

// Player utility functions
stock bool:is_user_valid(id) {
    return (1 <= id <= HLSTATSNEXT_MAX_PLAYERS) && is_user_connected(id);
}

// Configuration helper functions
stock bool:config_get_bool(const key[], bool:default_value = false) {
    // This would interface with the configuration system
    // For now, return default
    return default_value;
}

stock config_get_int(const key[], default_value = 0) {
    // This would interface with the configuration system
    // For now, return default
    return default_value;
}

stock config_get_string(const key[], output[], maxlen, const default_value[] = "") {
    // This would interface with the configuration system
    // For now, return default
    copy(output, maxlen, default_value);
}

// Error handling utilities
stock handle_error(const error_msg[]) {
    log_amx("[HLStatsNext ERROR] %s", error_msg);

    // Could also send to error reporting system
    if (is_debug_enabled()) {
        // Print stack trace or additional debug info
        debug_log("Error context: %s", error_msg);
    }
}

// Version comparison utility
stock bool:is_version_compatible(const required_version[], const current_version[]) {
    // Simple version comparison - could be enhanced
    return equal(required_version, current_version);
}

// Check if character is a digit (renamed to avoid conflict with core function)
stock bool:hlstatsnext_isdigit(c) {
    return c >= '0' && c <= '9';
}