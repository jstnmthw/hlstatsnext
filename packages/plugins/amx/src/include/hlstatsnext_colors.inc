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
    COLOR_TAG[4],        // [HLStatsNext] tag color
    COLOR_KILLER[4],     // Killer name color
    COLOR_VICTIM[4],     // Victim name color
    COLOR_POINTS_POS[4], // Positive points color
    COLOR_POINTS_NEG[4], // Negative points color
    COLOR_ACTION[4],     // Action text color
    COLOR_RESET[4]       // Reset/default color
}

// Default color scheme (green tag, red killer, blue victim)
new const g_default_colors[ColorScheme] = {
    "^2",  // Green for [HLStatsNext]
    "^1",  // Red for killer
    "^4",  // Blue for victim
    "^2",  // Green for positive points
    "^1",  // Red for negative points
    "^6",  // Cyan for actions
    "^0"   // White/default for reset
};

// Alternative color scheme
new const g_alternative_colors[ColorScheme] = {
    "^3",  // Yellow for [HLStatsNext]
    "^1",  // Red for killer
    "^4",  // Blue for victim
    "^2",  // Green for positive points
    "^1",  // Red for negative points
    "^5",  // Magenta for actions
    "^0"   // White/default for reset
};

// Current active color scheme
new g_current_colors[ColorScheme];
new bool:g_colors_enabled = true;

// Color initialization
stock hlstatsnext_colors_init() {
    // Copy default colors to current scheme
    copy_color_scheme(g_default_colors, g_current_colors);
    g_colors_enabled = true;

    log_amx("[HLStatsNext] Color system initialized");
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
        format(output, maxlen, "%s[HLStatsNext]%s",
               g_current_colors[COLOR_TAG],
               g_current_colors[COLOR_RESET]);
    } else {
        copy(output, maxlen, "[HLStatsNext]");
    }
}

stock format_colored_player(const name[], output[], maxlen, bool:is_killer = false) {
    if (g_colors_enabled) {
        new color[4];
        if (is_killer) {
            copy(color, charsmax(color), g_current_colors[COLOR_KILLER]);
        } else {
            copy(color, charsmax(color), g_current_colors[COLOR_VICTIM]);
        }
        format(output, maxlen, "%s%s%s", color, name, g_current_colors[COLOR_RESET]);
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
        new color[4];
        if (points > 0) {
            copy(color, charsmax(color), g_current_colors[COLOR_POINTS_POS]);
        } else {
            copy(color, charsmax(color), g_current_colors[COLOR_POINTS_NEG]);
        }
        format(output, maxlen, "%s%s%s", color, points_text, g_current_colors[COLOR_RESET]);
    } else {
        copy(output, maxlen, points_text);
    }
}

stock format_colored_action(const action[], output[], maxlen) {
    if (g_colors_enabled) {
        format(output, maxlen, "%s%s%s",
               g_current_colors[COLOR_ACTION],
               action,
               g_current_colors[COLOR_RESET]);
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

    log_amx("[HLStatsNext] Color scheme loaded: %s", scheme_name);
}