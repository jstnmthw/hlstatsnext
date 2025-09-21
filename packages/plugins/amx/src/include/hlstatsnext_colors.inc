/*
 * HLStatsNext Color Module
 *
 * Handles color formatting and schemes for messages
 */

#if defined _hlstatsnext_colors_included
    #endinput
#endif
#define _hlstatsnext_colors_included

// Color scheme structure
enum ColorScheme {
    COLOR_TAG[8],        // Plugin tag color
    COLOR_KILLER[8],     // Killer name color
    COLOR_VICTIM[8],     // Victim name color
    COLOR_POINTS_POS[8], // Positive points color
    COLOR_POINTS_NEG[8], // Negative points color
    COLOR_ACTION[8],     // Action text color
    COLOR_RESET[8]       // Reset/default color
}

// Default color scheme (using proper client_print_color codes)
new const g_default_colors[ColorScheme] = {
    "^4",  // Green for plugin tag
    "^3",  // Team color for killer
    "^4",  // Green for victim
    "^4",  // Green for positive points
    "^3",  // Team color for negative points
    "^4",  // Green for actions
    "^1"   // Default color for reset
};

// Alternative color scheme
new const g_alternative_colors[ColorScheme] = {
    "^3",  // Team color for plugin tag
    "^3",  // Team color for killer
    "^4",  // Green for victim
    "^4",  // Green for positive points
    "^3",  // Team color for negative points
    "^4",  // Green for actions
    "^1"   // Default color for reset
};

// Current active color scheme
new g_current_colors[ColorScheme];
new bool:g_colors_enabled = true;

// Color initialization
stock hlstatsnext_colors_init() {
    // Copy default colors to current scheme
    copy_color_scheme(g_default_colors, g_current_colors);
    g_colors_enabled = true;

    log_amx("%s Color system initialized", HLSTATSNEXT_TAG);
}

// Copy color scheme
stock copy_color_scheme(const source[ColorScheme], dest[ColorScheme]) {
    copy(dest[COLOR_TAG], charsmax(dest[COLOR_TAG]), source[COLOR_TAG]);
    copy(dest[COLOR_KILLER], charsmax(dest[COLOR_KILLER]), source[COLOR_KILLER]);
    copy(dest[COLOR_VICTIM], charsmax(dest[COLOR_VICTIM]), source[COLOR_VICTIM]);
    copy(dest[COLOR_POINTS_POS], charsmax(dest[COLOR_POINTS_POS]), source[COLOR_POINTS_POS]);
    copy(dest[COLOR_POINTS_NEG], charsmax(dest[COLOR_POINTS_NEG]), source[COLOR_POINTS_NEG]);
    copy(dest[COLOR_ACTION], charsmax(dest[COLOR_ACTION]), source[COLOR_ACTION]);
    copy(dest[COLOR_RESET], charsmax(dest[COLOR_RESET]), source[COLOR_RESET]);
}

// Format colored text components
stock format_colored_tag(output[], maxlen) {
    if (g_colors_enabled) {
        // Format: [^4HLStatsNext^1]: - brackets/colon default, text green
        format(output, maxlen, "^1[%sHLStatsNext^1]:",
               g_current_colors[COLOR_TAG]);
    } else {
        copy(output, maxlen, HLSTATSNEXT_TAG);
    }
}

stock format_colored_player(const name[], output[], maxlen, bool:is_killer = false) {
    if (g_colors_enabled) {
        if (is_killer) {
            format(output, maxlen, "%s%s%s", g_current_colors[COLOR_KILLER], name, g_current_colors[COLOR_RESET]);
        } else {
            format(output, maxlen, "%s%s%s", g_current_colors[COLOR_VICTIM], name, g_current_colors[COLOR_RESET]);
        }
    } else {
        copy(output, maxlen, name);
    }
}

stock format_colored_points(points, output[], maxlen) {
    new points_text[16];
    if (points > 0) {
        format(points_text, charsmax(points_text), "+%d", points);
    } else {
        format(points_text, charsmax(points_text), "%d", points);
    }

    if (g_colors_enabled) {
        if (points > 0) {
            format(output, maxlen, "%s%s%s", g_current_colors[COLOR_POINTS_POS], points_text, g_current_colors[COLOR_RESET]);
        } else {
            format(output, maxlen, "%s%s%s", g_current_colors[COLOR_POINTS_NEG], points_text, g_current_colors[COLOR_RESET]);
        }
    } else {
        copy(output, maxlen, points_text);
    }
}

stock format_colored_action(const action[], output[], maxlen) {
    if (g_colors_enabled) {
        format(output, maxlen, "%s%s%s", g_current_colors[COLOR_ACTION], action, g_current_colors[COLOR_RESET]);
    } else {
        copy(output, maxlen, action);
    }
}

// Configuration functions
stock set_colors_enabled(bool:enabled) {
    g_colors_enabled = enabled;
}

stock bool:are_colors_enabled() {
    return g_colors_enabled;
}

// Load color scheme from configuration file
stock load_color_scheme(const scheme_name[]) {
    // Load color scheme from hlstatsnext.cfg
    if (equal(scheme_name, "alternative")) {
        copy_color_scheme(g_alternative_colors, g_current_colors);
    } else {
        copy_color_scheme(g_default_colors, g_current_colors);
    }

    log_amx("%s Color scheme loaded: %s", HLSTATSNEXT_TAG, scheme_name);
}