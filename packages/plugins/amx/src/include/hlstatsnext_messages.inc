/*
 * HLStatsNext Message Module
 *
 * Handles basic message formatting and processing
 */

#if defined _hlstatsnext_messages_included
    #endinput
#endif
#define _hlstatsnext_messages_included

// Message module initialization
stock hlstatsnext_messages_init() {
    log_amx("%s Message system initialized", HLSTATSNEXT_TAG);
}

// Strip server prefix from message
stock strip_server_prefix(const raw_message[], output[], maxlen) {
    new pos = containi(raw_message, HLSTATSNEXT_TAG);
    if (pos != -1) {
        // Find the start of the actual message after the tag
        new start = pos + strlen(HLSTATSNEXT_TAG);
        while (raw_message[start] == ':' || raw_message[start] == ' ') {
            start++;
        }
        copy(output, maxlen, raw_message[start]);
    } else {
        // Look for common server prefixes and remove them
        new stripped[256];
        copy(stripped, charsmax(stripped), raw_message);

        // Remove "(ALL)" prefix
        pos = containi(stripped, "(ALL)");
        if (pos == 0) {
            new start = 5;
            while (stripped[start] == ' ') start++;
            copy(stripped, charsmax(stripped), stripped[start]);
        }

        // Remove server name prefixes like "[0x1] Server Name :"
        pos = contain(stripped, "] ");
        if (pos != -1 && stripped[0] == '[') {
            new start = pos + 2;
            pos = containi(stripped[start], " : ");
            if (pos != -1) {
                start = start + pos + 3;
                copy(stripped, charsmax(stripped), stripped[start]);
            }
        }

        copy(output, maxlen, stripped);
    }
}