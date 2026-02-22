/*
 * HLStatsNext Auth Beacon Module
 *
 * Sends periodic authentication beacons to the HLStatsNext daemon
 * via the engine's logaddress_add pipeline.
 *
 * Protocol: HLXTOKEN:<token>:<gamePort>
 *
 * SECURITY: The token is a credential. It MUST NOT appear in:
 *   - log_amx() output
 *   - server_print() output
 *   - console_print() output (to any player, including admins)
 *   - Any client-visible message
 *
 * The cvar uses FCVAR_PROTECTED | FCVAR_UNLOGGED to prevent
 * external visibility and log file leakage.
 */

#if defined _hlstatsnext_auth_included
  #endinput
#endif
#define _hlstatsnext_auth_included

// Auth beacon constants
#define HLXTOKEN_PREFIX       "HLXTOKEN"
#define AUTH_BEACON_INTERVAL  60.0
#define AUTH_BEACON_TASK_ID   7931  // Unique task ID to avoid collisions
#define AUTH_TOKEN_MIN_LENGTH 10    // Minimum plausible token length (hlxn_ + chars)

// Cvar pointer for hlx_token
new g_pcvar_token;

// Cached game port (read once from engine cvar)
new g_game_port;

// Auth beacon state
new bool:g_auth_beacon_active = false;

/*
 * Initialize the auth beacon system.
 * Registers the hlx_token cvar with FCVAR_PROTECTED | FCVAR_UNLOGGED.
 * Must be called from plugin_init().
 */
stock hlstatsnext_auth_init() {
  g_pcvar_token = create_cvar(
    "hlx_token",
    "",
    FCVAR_PROTECTED | FCVAR_UNLOGGED | FCVAR_SPONLY,
    "HLStatsNext authentication token (sensitive - never share)"
  );

  log_amx("%s Auth beacon system initialized", HLSTATSNEXT_TAG);
}

/*
 * Start the auth beacon system.
 * Reads the game port, sends an initial beacon, and schedules
 * repeating beacons every 60 seconds.
 * Must be called from OnConfigsExecuted() after all cvars are populated.
 */
stock hlstatsnext_auth_start() {
  // Read game port from engine cvars.
  // HLDS/ReHLDS uses "hostport" when -port is passed on command line.
  // "port" is only the default (27015) and isn't updated by -port.
  g_game_port = get_cvar_num("hostport");
  if (g_game_port <= 0) {
    g_game_port = get_cvar_num("port");
  }

  if (g_game_port <= 0) {
    log_amx("%s WARNING: Could not read game port from engine cvars 'hostport' or 'port'", HLSTATSNEXT_TAG);
    return;
  }

  // Send initial beacon immediately
  send_auth_beacon();

  // Schedule repeating beacon every 60 seconds
  set_task(AUTH_BEACON_INTERVAL, "task_auth_beacon", AUTH_BEACON_TASK_ID, "", 0, "b");
  g_auth_beacon_active = true;

  log_amx("%s Auth beacon started (port: %d, interval: %.0fs)", HLSTATSNEXT_TAG, g_game_port, AUTH_BEACON_INTERVAL);
}

/*
 * Stop the auth beacon system.
 * Removes the repeating task. Must be called from plugin_end().
 */
stock hlstatsnext_auth_stop() {
  if (g_auth_beacon_active) {
    remove_task(AUTH_BEACON_TASK_ID);
    g_auth_beacon_active = false;
    log_amx("%s Auth beacon stopped", HLSTATSNEXT_TAG);
  }
}

/*
 * Send a single authentication beacon through the engine log pipeline.
 *
 * Uses log_message() which is the standard AMX Mod X native for writing
 * to the engine log. Unlike engfunc(EngFunc_AlertMessage), log_message()
 * reliably forwards through logaddress_add on all HLDS/ReHLDS builds.
 *
 * Format: HLXTOKEN:<token>:<gamePort>
 * (log_message appends its own newline)
 *
 * SECURITY: This function intentionally does NOT log the token value.
 * Only the presence/absence of a configured token is logged for diagnostics.
 */
stock send_auth_beacon() {
  new token[128];
  get_pcvar_string(g_pcvar_token, token, charsmax(token));

  // Validate token is configured
  new token_len = strlen(token);
  if (token_len < AUTH_TOKEN_MIN_LENGTH) {
    // Always log this — it's a critical operational issue, not debug noise
    log_amx("%s WARNING: Auth beacon skipped - hlx_token not configured (set it in server.cfg or hlstatsnext.cfg)", HLSTATSNEXT_TAG);
    return;
  }

  // Send beacon through engine log pipeline via logaddress_add
  // log_message() writes directly to the engine log and forwards to all
  // logaddress_add targets (including the daemon's UDP listener)
  log_message("%s:%s:%d", HLXTOKEN_PREFIX, token, g_game_port);

  if (is_debug_enabled()) {
    // SECURITY: Log beacon sent confirmation WITHOUT the token value
    log_amx("%s Auth beacon sent (port: %d, token length: %d)", HLSTATSNEXT_TAG, g_game_port, token_len);
  }
}

/*
 * Task callback for repeating auth beacon.
 * Public function required by set_task().
 */
public task_auth_beacon() {
  if (!is_plugin_active()) {
    return;
  }

  send_auth_beacon();
}
